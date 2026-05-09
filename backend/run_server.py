"""PyInstaller 打包入口：启动 FastAPI/Uvicorn 服务。

frozen 模式下：
- 把同级目录里的 ms-playwright/ 设为 patchright 浏览器目录，做到「装完即用」
- 数据目录(.sqlite/profiles/logs)放在用户级目录，卸载/重装不会丢
  · Windows : %APPDATA%/AutoResume
  · macOS   : ~/Library/Application Support/AutoResume
  · Linux   : ~/.local/share/AutoResume
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def _user_data_dir() -> Path:
    """返回当前平台的用户数据目录（不创建，调用方负责 mkdir）。"""
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or str(Path.home())
        return Path(base) / "AutoResume"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "AutoResume"
    base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / "AutoResume"


def _bootstrap_frozen() -> None:
    """打包后的环境配置：浏览器路径 + 用户数据目录。"""
    if not getattr(sys, "frozen", False):
        return
    exe_dir = Path(sys.executable).parent
    browsers_dir = exe_dir / "ms-playwright"
    if browsers_dir.exists():
        os.environ.setdefault("PATCHRIGHT_BROWSERS_PATH", str(browsers_dir))
        os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(browsers_dir))

    user_dir = _user_data_dir()
    user_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("AUTORESUME_DATA_DIR", str(user_dir))


_bootstrap_frozen()

import uvicorn  # noqa: E402  — 必须在环境变量设置之后再 import

if __name__ == "__main__":
    port = int(os.environ.get("AUTORESUME_PORT", "8765"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, log_level="info")
