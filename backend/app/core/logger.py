"""任务日志：每个任务独立的内存环形缓冲 + 落盘文件。"""
from __future__ import annotations

import logging
from collections import deque
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Deque, Dict, List

from .config import LOGS_DIR

_MAX_MEMORY_LINES = 500


class TaskLogger:
    """单任务日志器：内存最近 N 条 + 文件追加。"""

    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        self._buffer: Deque[dict] = deque(maxlen=_MAX_MEMORY_LINES)
        self._lock = Lock()
        self._file_path: Path = LOGS_DIR / f"{task_id}.log"
        self._file_logger = self._build_file_logger()

    def _build_file_logger(self) -> logging.Logger:
        logger = logging.getLogger(f"task.{self.task_id}")
        logger.setLevel(logging.INFO)
        logger.propagate = False
        if not logger.handlers:
            handler = logging.FileHandler(self._file_path, encoding="utf-8")
            handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
            logger.addHandler(handler)
        return logger

    def log(self, level: str, message: str) -> dict:
        entry = {"ts": datetime.now().isoformat(timespec="seconds"), "level": level, "msg": message}
        with self._lock:
            self._buffer.append(entry)
        getattr(self._file_logger, level.lower(), self._file_logger.info)(message)
        return entry

    def info(self, message: str) -> dict: return self.log("INFO", message)
    def warn(self, message: str) -> dict: return self.log("WARN", message)
    def error(self, message: str) -> dict: return self.log("ERROR", message)
    def success(self, message: str) -> dict: return self.log("SUCCESS", message)

    def tail(self, n: int = 200) -> List[dict]:
        with self._lock:
            return list(self._buffer)[-n:]


_registry: Dict[str, TaskLogger] = {}
_registry_lock = Lock()


def get_logger(task_id: str) -> TaskLogger:
    with _registry_lock:
        if task_id not in _registry:
            _registry[task_id] = TaskLogger(task_id)
        return _registry[task_id]
