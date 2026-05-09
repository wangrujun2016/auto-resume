"""全局配置：路径、默认参数。

数据目录优先级：
  1. 环境变量 AUTORESUME_DATA_DIR（打包后由 run_server.py 注入到 %APPDATA%/AutoResume）
  2. 项目根 backend/data（开发期默认）
"""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
_env_data = os.environ.get("AUTORESUME_DATA_DIR")
DATA_DIR = Path(_env_data) if _env_data else BASE_DIR / "data"
PROFILES_DIR = DATA_DIR / "profiles"
LOGS_DIR = DATA_DIR / "logs"
DB_PATH = DATA_DIR / "auto_resume.sqlite"

DATA_DIR.mkdir(parents=True, exist_ok=True)
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_INTERVAL_SECONDS = 30
DEFAULT_DAILY_LIMIT = 10
DEFAULT_CLICK_DELAY_SECONDS = 5  # 点开左侧岗位 → 等多久 → 点右侧「立即沟通」
BOSS_HOME = "https://www.zhipin.com/"
BOSS_SEARCH_URL = "https://www.zhipin.com/web/geek/job"
