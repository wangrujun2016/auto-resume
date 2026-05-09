"""任务相关的数据传输对象（DTO）。

注意：本模块刻意不使用 `from __future__ import annotations`。
Pydantic v2 在 PEP 563 延迟注解模式下，如果声明 `Optional[X] = None` 且 X 是同模块内的另一个 BaseModel，
有时会因解析上下文错乱把字段误判为 required（曾出现 422 missing 错误）。直接使用真实类型最稳。
"""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

TaskStatus = Literal[
    "idle",          # 已创建未启动（未登录或上次正常退出）
    "launching",     # 浏览器启动中
    "awaiting_login",# 等待用户扫码/账密登录
    "logged_in",     # 登录已完成，浏览器已关闭，可启动自动化
    "running",       # 正在执行打招呼循环
    "paused",        # 用户暂停
    "stopped",       # 用户停止
    "finished",      # 当日打满
    "error",         # 出错
]


class JobFilter(BaseModel):
    """岗位筛选条件，全部可选。"""
    keyword: str = Field(..., description="搜索关键词，如 Python 后端")
    city: Optional[str] = Field(None, description="城市名，如 深圳；为空表示全国")
    salary: Optional[str] = Field(None, description="BOSS salary 参数，如 405 表示 10-20k")
    experience: Optional[str] = Field(None, description="工作经验，BOSS experience 参数")
    degree: Optional[str] = Field(None, description="学历，BOSS degree 参数")
    scale: Optional[str] = Field(None, description="公司规模，BOSS scale 参数")
    exclude_keywords: List[str] = Field(default_factory=list, description="黑名单关键词，岗位/公司名命中则跳过")


class SubTask(BaseModel):
    """单条搜索条件 + 该条件下要打招呼的次数。"""
    filter: JobFilter
    limit: int = Field(10, ge=1, le=200, description="该子任务在今日内打招呼的目标次数")


class TaskCreate(BaseModel):
    """新建/编辑任务负载。

    sub_tasks 至少 1 条；filter/daily_limit 仅作老前端兼容字段。
    """
    name: str
    sub_tasks: List[SubTask] = []
    filter: Optional[JobFilter] = None  # 兼容老前端：只传 filter 时后端会包成单子任务
    greetings: List[str] = []
    interval_seconds: int = Field(default=30, ge=10, le=600)
    daily_limit: int = Field(default=50, ge=1, le=2000)
    click_delay_seconds: int = Field(default=5, ge=0, le=30)


class TaskInfo(BaseModel):
    id: str
    name: str
    status: TaskStatus
    sub_tasks: List[SubTask] = Field(default_factory=list)
    filter: Optional[JobFilter] = None
    greetings: List[str]
    interval_seconds: int
    daily_limit: int
    click_delay_seconds: int = 5
    sent_today: int = 0
    current_sub_index: int = 0
    skipped_today: int = 0
    last_msg: Optional[str] = None
    last_url: Optional[str] = None
    has_login: bool = False
    created_at: str
