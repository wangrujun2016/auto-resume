"""SQLite 持久化：任务定义 + 已打招呼岗位记录（按账号 + 日期幂等）。"""
from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from threading import Lock
from typing import Iterable, List, Optional

from ..core.config import DB_PATH
from ..schemas.task import JobFilter, SubTask, TaskInfo

_lock = Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def transaction():
    with _lock:
        conn = _connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def init_db() -> None:
    with transaction() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS tasks(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                filter_json TEXT NOT NULL,
                greetings_json TEXT NOT NULL,
                interval_seconds INTEGER NOT NULL,
                daily_limit INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS greeted_jobs(
                task_id TEXT NOT NULL,
                job_key TEXT NOT NULL,
                day TEXT NOT NULL,
                greeted_at TEXT NOT NULL,
                title TEXT,
                company TEXT,
                PRIMARY KEY (task_id, job_key, day)
            );
            CREATE INDEX IF NOT EXISTS idx_greeted_day ON greeted_jobs(task_id, day);
            """
        )
        # 兼容已有库：补字段（重复执行幂等，绝不删除老字段）
        for stmt in [
            "ALTER TABLE tasks ADD COLUMN click_delay_seconds INTEGER NOT NULL DEFAULT 5",
            "ALTER TABLE tasks ADD COLUMN sub_tasks_json TEXT",
            "ALTER TABLE greeted_jobs ADD COLUMN sub_index INTEGER NOT NULL DEFAULT 0",
        ]:
            try: c.execute(stmt)
            except sqlite3.OperationalError: pass
        # 给 greeted_jobs 加按子任务计数的索引
        try:
            c.execute(
                "CREATE INDEX IF NOT EXISTS idx_greeted_day_sub ON greeted_jobs(task_id, day, sub_index)"
            )
        except sqlite3.OperationalError:
            pass


def save_task(info: TaskInfo) -> None:
    """持久化任务。

    sub_tasks_json 是新字段（多子任务）；filter_json 保留为兼容字段，
    取 sub_tasks 第一个的 filter，便于老查询逻辑/老前端读取。
    """
    sub_tasks = info.sub_tasks or _wrap_legacy(info.filter, info.daily_limit)
    fallback_filter = sub_tasks[0].filter if sub_tasks else info.filter
    if fallback_filter is None:
        # 不应该发生：schema 校验过 sub_tasks 至少 1 条
        raise ValueError("task has no filter / sub_tasks")

    with transaction() as c:
        c.execute(
            """
            INSERT OR REPLACE INTO tasks(
                id, name, filter_json, greetings_json,
                interval_seconds, daily_limit, click_delay_seconds,
                sub_tasks_json, created_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                info.id, info.name,
                fallback_filter.model_dump_json(),
                json.dumps(info.greetings, ensure_ascii=False),
                info.interval_seconds, info.daily_limit, info.click_delay_seconds,
                json.dumps([s.model_dump() for s in sub_tasks], ensure_ascii=False),
                info.created_at,
            ),
        )


def _wrap_legacy(filter_: Optional[JobFilter], daily_limit: int) -> List[SubTask]:
    """老任务（只有 filter）→ 单子任务包装。"""
    if filter_ is None:
        return []
    return [SubTask(filter=filter_, limit=daily_limit)]


def list_tasks() -> List[TaskInfo]:
    with transaction() as c:
        rows = c.execute("SELECT * FROM tasks ORDER BY created_at DESC").fetchall()
    return [_row_to_task(r) for r in rows]


def get_task(task_id: str) -> Optional[TaskInfo]:
    with transaction() as c:
        row = c.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return _row_to_task(row) if row else None


def delete_task(task_id: str) -> None:
    with transaction() as c:
        c.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        c.execute("DELETE FROM greeted_jobs WHERE task_id = ?", (task_id,))


def _row_to_task(row: sqlite3.Row) -> TaskInfo:
    keys = row.keys()
    legacy_filter = JobFilter.model_validate_json(row["filter_json"]) if row["filter_json"] else None
    daily_limit = row["daily_limit"]

    # 优先读 sub_tasks_json；老库没这列时按 legacy_filter+daily_limit 包装一条
    sub_tasks: List[SubTask] = []
    if "sub_tasks_json" in keys and row["sub_tasks_json"]:
        try:
            sub_tasks = [SubTask(**item) for item in json.loads(row["sub_tasks_json"])]
        except Exception:
            sub_tasks = []
    if not sub_tasks:
        sub_tasks = _wrap_legacy(legacy_filter, daily_limit)

    return TaskInfo(
        id=row["id"], name=row["name"],
        status="idle",
        sub_tasks=sub_tasks,
        filter=legacy_filter,
        greetings=json.loads(row["greetings_json"]),
        interval_seconds=row["interval_seconds"], daily_limit=daily_limit,
        click_delay_seconds=row["click_delay_seconds"] if "click_delay_seconds" in keys else 5,
        created_at=row["created_at"],
    )


def has_greeted_today(task_id: str, job_key: str) -> bool:
    """是否在今日已经招呼过该岗位（跨子任务幂等：同 task 同 job 同 day 只算一次）。"""
    today = date.today().isoformat()
    with transaction() as c:
        row = c.execute(
            "SELECT 1 FROM greeted_jobs WHERE task_id=? AND job_key=? AND day=?",
            (task_id, job_key, today),
        ).fetchone()
    return row is not None


def mark_greeted(task_id: str, job_key: str, title: str, company: str, ts_iso: str, sub_index: int = 0) -> None:
    """写入已招呼记录前清理薪资乱码，避免历史脏数据污染。"""
    today = date.today().isoformat()
    with transaction() as c:
        c.execute(
            """
            INSERT OR IGNORE INTO greeted_jobs(task_id, job_key, day, greeted_at, title, company, sub_index)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (task_id, job_key, today, ts_iso, _clean_title(title), _clean_title(company), sub_index),
        )


def count_greeted_today(task_id: str, sub_index: Optional[int] = None) -> int:
    """今日已招呼次数。sub_index 给定时只统计某一子任务；为 None 时统计所有子任务合计。"""
    today = date.today().isoformat()
    with transaction() as c:
        if sub_index is None:
            row = c.execute(
                "SELECT COUNT(*) AS n FROM greeted_jobs WHERE task_id=? AND day=?",
                (task_id, today),
            ).fetchone()
        else:
            row = c.execute(
                "SELECT COUNT(*) AS n FROM greeted_jobs WHERE task_id=? AND day=? AND sub_index=?",
                (task_id, today, sub_index),
            ).fetchone()
    return int(row["n"]) if row else 0


# BOSS 反爬清洗：
# 1) PUA 区字符（U+E000-U+F8FF）—— 自定义字体最常用的范围
# 2) 几何方块「方框」字符（U+25A0-U+25FF）—— 渲染失败时的兜底"豆腐"字符
# 3) 几何形状/盒元素（U+2580-U+259F、U+2B1B/2B1C/25A1 等常见占位字符）
_GIBBERISH_RE = re.compile(r'[\uE000-\uF8FF\u25A0-\u25FF\u2580-\u259F\u2B1B\u2B1C]+')

# title 末尾的薪资段：「空格 + 一段非中文非空白 + K(或薪) + 任意」
# 例：「web前端开发工程师 □□-□□K·□□薪」末尾整段都剥掉
_SALARY_TAIL_RE = re.compile(r'\s+[^\s\u4e00-\u9fff]*[Kk薪][^\u4e00-\u9fff]*$')


def _clean_title(s: Optional[str]) -> str:
    """清理岗位标题/公司名：去乱码字符 + 砍掉末尾薪资段。"""
    if not s: return ""
    out = _GIBBERISH_RE.sub("", s)
    out = re.sub(r"\s+", " ", out).strip()
    # 砍尾循环：一次可能剥不干净（连写「-K·薪」「.5K」之类），最多剥 3 轮
    for _ in range(3):
        new_out = _SALARY_TAIL_RE.sub("", out).strip()
        if new_out == out: break
        out = new_out
    # 剥完后末尾遗留孤立的 「-」「·」「,」
    out = re.sub(r"[\-·,，\s]+$", "", out).strip()
    return out


def list_greeted_today(task_id: str, limit: int = 100) -> List[dict]:
    today = date.today().isoformat()
    with transaction() as c:
        rows = c.execute(
            "SELECT job_key, greeted_at, title, company FROM greeted_jobs WHERE task_id=? AND day=? ORDER BY greeted_at DESC LIMIT ?",
            (task_id, today, limit),
        ).fetchall()
    items: List[dict] = []
    for r in rows:
        d = dict(r)
        d["title"] = _clean_title(d.get("title"))
        d["company"] = _clean_title(d.get("company"))
        items.append(d)
    return items
