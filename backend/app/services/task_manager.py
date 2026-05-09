"""任务管理器：每个任务在独立线程里跑独立的 Proactor 事件循环。

为什么这样设计：
- Windows 上 Playwright 启动浏览器需要 ProactorEventLoop（subprocess 支持）
- uvicorn / 默认事件循环不一定是 Proactor
- 把每个 BOSS 任务隔离到独立线程 + 独立 Proactor loop，可同时获得：
  1. Windows 子进程兼容
  2. 浏览器阻塞操作不会拖慢 FastAPI 主循环
  3. 多任务真正并行
- 跨循环的回调（推送日志/状态到 WebSocket）通过 run_coroutine_threadsafe
  调度回 FastAPI 的主循环执行，保证 WebSocket 对象只在自己的 loop 里被访问。
"""
from __future__ import annotations

import asyncio
import sys
import threading
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import WebSocket

from ..core.logger import get_logger
from ..schemas.task import TaskCreate, TaskInfo
from . import storage
from .boss_automator import BossAutomator, clear_login_session, clear_profile, has_login_session


class TaskRuntime:
    """单任务的运行时状态。"""

    def __init__(self, info: TaskInfo) -> None:
        self.info = info
        self.automator: Optional[BossAutomator] = None
        self.thread: Optional[threading.Thread] = None
        self.thread_loop: Optional[asyncio.AbstractEventLoop] = None
        self.subscribers: List[WebSocket] = []

    def to_dict(self) -> dict:
        d = self.info.model_dump()
        d["sent_today"] = storage.count_greeted_today(self.info.id)
        d["has_login"] = has_login_session(self.info.id)
        # 各子任务今日已发数（前端展示进度）
        d["sub_sent_today"] = [
            storage.count_greeted_today(self.info.id, sub_index=i)
            for i in range(len(self.info.sub_tasks))
        ]
        return d


class TaskManager:
    def __init__(self) -> None:
        self._runtimes: Dict[str, TaskRuntime] = {}
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None  # FastAPI 主循环

    async def init(self) -> None:
        """启动时记录 FastAPI 主循环 + 加载已保存任务。"""
        self._main_loop = asyncio.get_running_loop()
        for info in storage.list_tasks():
            self._runtimes[info.id] = TaskRuntime(info)

    # ---------------- CRUD ----------------
    async def create(self, payload: TaskCreate) -> TaskInfo:
        sub_tasks = self._resolve_sub_tasks(payload)
        info = TaskInfo(
            id=uuid.uuid4().hex[:12],
            name=payload.name,
            status="idle",
            sub_tasks=sub_tasks,
            filter=sub_tasks[0].filter,  # 兼容老字段：取首个子任务的 filter
            greetings=payload.greetings,
            interval_seconds=payload.interval_seconds,
            daily_limit=payload.daily_limit,
            click_delay_seconds=payload.click_delay_seconds,
            created_at=datetime.now().isoformat(timespec="seconds"),
        )
        storage.save_task(info)
        self._runtimes[info.id] = TaskRuntime(info)
        return info

    async def update(self, task_id: str, payload: TaskCreate) -> TaskInfo:
        """编辑任务：保留 id/created_at/状态，其余字段按 payload 覆盖。

        正在运行的任务会先被自动停止，新配置在下次手动启动时生效。
        """
        rt = self._runtimes.get(task_id)
        if not rt: raise KeyError(task_id)
        if rt.thread and rt.thread.is_alive():
            await self.stop(task_id)

        sub_tasks = self._resolve_sub_tasks(payload)
        rt.info.name = payload.name
        rt.info.sub_tasks = sub_tasks
        rt.info.filter = sub_tasks[0].filter
        rt.info.greetings = payload.greetings
        rt.info.interval_seconds = payload.interval_seconds
        rt.info.daily_limit = payload.daily_limit
        rt.info.click_delay_seconds = payload.click_delay_seconds
        storage.save_task(rt.info)
        return rt.info

    @staticmethod
    def _resolve_sub_tasks(payload: TaskCreate):
        """统一处理 payload → sub_tasks：优先 payload.sub_tasks；老前端只传 filter 时包装一个。"""
        from ..schemas.task import SubTask
        sub_tasks = list(payload.sub_tasks)
        if not sub_tasks and payload.filter is not None:
            sub_tasks = [SubTask(filter=payload.filter, limit=payload.daily_limit)]
        if not sub_tasks:
            raise ValueError("sub_tasks 至少需要 1 条")
        return sub_tasks

    def list(self) -> List[dict]:
        return [rt.to_dict() for rt in self._runtimes.values()]

    def get(self, task_id: str) -> Optional[TaskRuntime]:
        return self._runtimes.get(task_id)

    async def remove(self, task_id: str) -> None:
        await self.stop(task_id)
        storage.delete_task(task_id)
        clear_login_session(task_id)
        clear_profile(task_id)  # 删除任务时一并清掉浏览器 profile
        self._runtimes.pop(task_id, None)

    # ---------------- 控制 ----------------
    async def start(self, task_id: str) -> dict:
        """启动完整自动化（登录 + 打招呼循环）。"""
        return await self._launch_worker(task_id, mode="run")

    async def start_login(self, task_id: str) -> dict:
        """仅登录模式：让用户在浏览器里完成登录，关闭浏览器，保存 cookie。"""
        return await self._launch_worker(task_id, mode="login")

    async def _launch_worker(self, task_id: str, mode: str) -> dict:
        rt = self._runtimes.get(task_id)
        if not rt: raise KeyError(task_id)
        if rt.thread and rt.thread.is_alive():
            return rt.to_dict()

        logger = get_logger(task_id)
        main_loop = self._main_loop or asyncio.get_running_loop()

        # 跨循环回调：worker 线程里 await 时调度回 FastAPI 主循环执行
        async def on_log(entry: dict) -> None:
            await self._call_in_main_loop(main_loop, self._broadcast(task_id, {
                "type": "log", "task_id": task_id, "entry": entry,
            }))

        async def on_status(status: str, payload: dict) -> None:
            rt.info.status = status  # type: ignore[assignment]
            if "last_msg" in payload:
                rt.info.last_msg = payload["last_msg"]
            await self._call_in_main_loop(main_loop, self._broadcast(task_id, {
                "type": "status", "task_id": task_id, "status": status,
                "payload": payload, "info": rt.to_dict(),
            }))

        rt.automator = BossAutomator(
            task_id=task_id, name=rt.info.name,
            sub_tasks=rt.info.sub_tasks,
            greetings=rt.info.greetings,
            interval_seconds=rt.info.interval_seconds,
            daily_limit=rt.info.daily_limit,
            click_delay_seconds=rt.info.click_delay_seconds,
            logger=logger, on_log=on_log, on_status=on_status,
        )

        rt.thread = threading.Thread(
            target=_run_in_thread, args=(rt, mode),
            name=f"task-{task_id}-{mode}", daemon=True,
        )
        rt.thread.start()
        return rt.to_dict()

    async def pause(self, task_id: str) -> None:
        rt = self._runtimes.get(task_id)
        if rt and rt.automator: rt.automator.request_pause()

    async def resume(self, task_id: str) -> None:
        rt = self._runtimes.get(task_id)
        if rt and rt.automator: rt.automator.request_resume()

    async def stop(self, task_id: str) -> None:
        rt = self._runtimes.get(task_id)
        if not rt: return
        if rt.automator: rt.automator.request_stop()
        # 等线程自然退出（最多 15s），失败就放弃
        if rt.thread and rt.thread.is_alive():
            await asyncio.to_thread(rt.thread.join, 15)
        rt.info.status = "stopped"

    # ---------------- WebSocket ----------------
    def subscribe(self, task_id: str, ws: WebSocket) -> None:
        rt = self._runtimes.get(task_id)
        if rt: rt.subscribers.append(ws)

    def unsubscribe(self, task_id: str, ws: WebSocket) -> None:
        rt = self._runtimes.get(task_id)
        if rt and ws in rt.subscribers: rt.subscribers.remove(ws)

    async def _broadcast(self, task_id: str, message: dict) -> None:
        rt = self._runtimes.get(task_id)
        if not rt: return
        dead: List[WebSocket] = []
        for ws in rt.subscribers:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.unsubscribe(task_id, ws)

    @staticmethod
    async def _call_in_main_loop(main_loop: asyncio.AbstractEventLoop, coro) -> None:
        """从 worker 线程的 loop 里调度协程到主 loop 执行并等待完成。"""
        future = asyncio.run_coroutine_threadsafe(coro, main_loop)
        await asyncio.wrap_future(future)


def _run_in_thread(rt: TaskRuntime, mode: str) -> None:
    """工作线程入口：建立独立 Proactor 事件循环并跑 automator。

    mode:
      - "run":   完整自动化流程（登录 + 打招呼循环）
      - "login": 仅登录，登录完成关闭浏览器
    """
    if sys.platform == "win32":
        # Playwright 子进程必须在 Proactor loop 上
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    rt.thread_loop = loop
    try:
        coro = rt.automator.run_login_only() if mode == "login" else rt.automator.run()  # type: ignore[union-attr]
        loop.run_until_complete(coro)
    except BaseException:
        # 包含 CancelledError（用户停止）和其他异常，automator 内部已记日志
        pass
    finally:
        try: loop.close()
        except Exception: pass


manager = TaskManager()
