"""PyInstaller 打包入口：启动 FastAPI/Uvicorn 服务。

frozen 模式下：
- 把同级目录里的 ms-playwright/ 设为 patchright 浏览器目录，做到「装完即用」
- 数据目录(.sqlite/profiles/logs)放在 %APPDATA%/AutoResume，避免被卸载清掉
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def _bootstrap_frozen() -> None:
    """打包后的环境配置：浏览器路径 + 用户数据目录。"""
    if not getattr(sys, "frozen", False):
        return
    exe_dir = Path(sys.executable).parent
    browsers_dir = exe_dir / "ms-playwright"
    if browsers_dir.exists():
        os.environ.setdefault("PATCHRIGHT_BROWSERS_PATH", str(browsers_dir))
        os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(browsers_dir))

    appdata = os.environ.get("APPDATA") or str(Path.home())
    user_dir = Path(appdata) / "AutoResume"
    user_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("AUTORESUME_DATA_DIR", str(user_dir))


_bootstrap_frozen()

import uvicorn  # noqa: E402  — 必须在环境变量设置之后再 import

if __name__ == "__main__":
    port = int(os.environ.get("AUTORESUME_PORT", "8765"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, log_level="info")
