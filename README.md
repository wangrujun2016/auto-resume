# BOSS 直聘自动招呼助手 (auto-resume)

一个 Electron + React + Python(FastAPI + Playwright) 的桌面应用：

- ✅ 多账号并行：每个账号一个独立的 Chromium `user_data_dir`，cookie/登录态互不污染
- ✅ 自定义筛选：关键词、城市、薪资、经验、学历、公司规模、黑名单关键词
- ✅ 自动打招呼：默认每 30 秒一次（含随机抖动），每天默认上限 10 次
- ✅ 已招呼幂等：SQLite 记录每日已招呼岗位，避免重复
- ✅ 实时日志：WebSocket 推送每条操作日志
- ✅ 启停可控：开始 / 暂停 / 继续 / 停止

> 说明：BOSS 直聘服务条款不允许自动化操作，本项目仅供学习交流。请合理控制频率，账号风险自担。

---

## 一、依赖准备（首次运行必读）

### 1. Python 3.10+

> 你当前环境只有 Python 2.7，**必须**额外安装 Python 3。

- 下载：<https://www.python.org/downloads/>
- 安装时勾选 **"Add Python to PATH"**
- 验证：

  ```powershell
  python --version   # 应显示 3.10 或更高
  ```

### 2. Node.js 18+

你已有 Node 22，无需操作。

### 3. Chrome 浏览器

Playwright 默认通过 `channel="chrome"` 调用本机 Chrome；如果没有 Chrome 也可以改成下载 Chromium（见下方"可选"）。

---

## 二、安装项目依赖

打开 PowerShell，进入项目目录：

```powershell
cd E:\PROJECT\auto-resume
```

### 1. 前端 / Electron 依赖

```powershell
npm run install:all
```

### 2. Python 依赖（建议虚拟环境）

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
cd ..
```

> 如果你**已经装了 Chrome**，`playwright install chromium` 这一步可以省略；automator 会优先使用本机 Chrome。

---

## 三、启动开发模式

```powershell
npm run dev
```

会同时启动三个进程：

| 名称       | 端口 / 说明                            |
| ---------- | -------------------------------------- |
| `PY`       | Python FastAPI（127.0.0.1:8765）       |
| `VITE`     | React 前端开发服务器（127.0.0.1:5173） |
| `ELECTRON` | Electron 桌面壳，加载前端              |

Electron 窗口出现后，你就能看到主界面。

> 如果 PowerShell 提示 `python` 命令找不到，需要确认 Python 3 已加入 PATH，重启终端再试。

---

## 四、使用流程

1. **新建账号任务**：左上角「+ 新建账号任务」按钮

   - 任务别名：随便起一个，用于区分账号（如「账号 A - Python 后端」）
   - 关键词：BOSS 搜索框里的内容
   - 其他筛选项：可选
   - 招呼语：可留空（用 BOSS 默认），也可写多条（每行一条，每次随机选一条更像真人）
   - 间隔秒数 / 每日上限：默认 30s / 10 次

2. **点击「开始」**：会弹出一个独立的 Chromium 窗口

   - 第一次需要自己手动登录（扫码或账密均可）
   - 登录成功后程序自动跳转到搜索页，开始打招呼
   - 之后再次启动同一个任务，**会复用上次的 cookie 自动登录**

3. **添加更多账号**：再次「新建任务」用不同的别名 → 点击「开始」会弹出**另一个独立**的浏览器窗口，账号互不污染

4. **暂停 / 继续 / 停止**：在任务卡片上操作

5. **查看进度**：点击任务卡片进入详情页，可看到：
   - 实时运行日志（WebSocket 推送）
   - 今日已招呼列表

---

## 五、目录结构

```
auto-resume/
├── package.json              # 根：electron + dev 脚本
├── electron/                 # Electron 主进程
│   ├── main.cjs
│   └── preload.cjs
├── frontend/                 # React + Vite + TS + Tailwind
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── api/client.ts     # REST + WebSocket 客户端
│       ├── store/useTasks.ts
│       └── components/
│           ├── NewTaskModal.tsx
│           ├── TaskCard.tsx
│           ├── TaskDetail.tsx
│           └── StatusBadge.tsx
└── backend/                  # Python FastAPI + Playwright
    ├── requirements.txt
    └── app/
        ├── main.py
        ├── api/tasks.py            # REST + WebSocket 路由
        ├── core/{config,logger}.py
        ├── schemas/task.py         # Pydantic DTO
        └── services/
            ├── boss_automator.py   # 核心：列表抓取 + 自动打招呼
            ├── task_manager.py     # 多任务编排
            └── storage.py          # SQLite：任务定义 + 已招呼幂等
```

数据存放：

- `backend/data/profiles/<task_id>/` 每个任务的浏览器 profile（cookie 等）
- `backend/data/auto_resume.sqlite` 任务与已招呼记录
- `backend/logs/<task_id>.log` 文件日志

这些目录**不会**被 git 追踪。

---

## 六、常见问题

**Q1. 打招呼按钮点不到 / 选择器失效？**
BOSS 前端会改 DOM。`backend/app/services/boss_automator.py` 里的选择器（`.start-chat-btn` / `.dialog-container textarea` 等）可能需要按当前页面调整。日志里会有 `打招呼失败` 提示。

**Q2. 提示"登录超时"？**
默认等待登录 10 分钟。如需更长，调 `boss_automator._wait_for_login(timeout_seconds=...)`。

**Q3. 想改成隐藏浏览器（headless）？**
不推荐——首次必须登录、且 BOSS 风控对 headless 较敏感。如确实要，把 `boss_automator._launch` 中的 `headless=False` 改 `True`。

**Q4. 怎么彻底退出某个账号？**
删除任务时浏览器 profile 会保留。如需重新登录，手动删除 `backend/data/profiles/<task_id>/`。

---

## 七、生产打包

> 浏览器二进制（Chromium）是平台专属，**Windows 包必须在 Windows 上打，macOS 包必须在 macOS 上打**，不能交叉编译。

### 7.1 Windows（在 Windows 上）

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
npm run dist:win
```

产物：

| 路径 | 用途 |
| --- | --- |
| `release/BOSS自动招呼助手-Setup-0.1.0.exe` | NSIS 安装包（双击安装） |
| `release/win-unpacked/` | 解压版（直接跑里面的 .exe，不用安装） |

### 7.2 macOS（在 Mac 上）

依赖一次性准备：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install pyinstaller==6.10.0
python -m patchright install chromium
cd ..
npm run install:all
```

打包：

```bash
# 同时出 Intel(x64) 和 Apple Silicon(arm64) 的 .dmg + .zip
npm run dist:mac

# 只打当前架构 + dmg
npm run dist:mac:dmg

# 只想要解压目录（调试时用，最快）
npm run dist:mac:dir
```

产物：

| 路径 | 用途 |
| --- | --- |
| `release/BOSS自动招呼助手-0.1.0-x64.dmg` | Intel Mac 安装镜像 |
| `release/BOSS自动招呼助手-0.1.0-arm64.dmg` | Apple Silicon 安装镜像 |
| `release/mac-arm64/BOSS自动招呼助手.app` | 解压版 .app（直接拖进去就能跑） |

### 7.3 安装与首次运行注意

**Windows**：未签名，SmartScreen 会拦截，点「更多信息 → 仍要运行」。

**macOS**：未做 Apple 公证，首次启动会提示「已损坏 / 无法验证开发者」。两种解决：

```bash
# 方法 A：右键点 .app → 打开 → 仍然打开（一次后系统会记住）

# 方法 B：直接清掉 quarantine 标记（推荐）
xattr -dr com.apple.quarantine "/Applications/BOSS自动招呼助手.app"
```

### 7.4 数据目录

打包后的应用，用户数据（浏览器 profile / SQLite / 日志）写在：

| 平台 | 路径 |
| --- | --- |
| Windows | `%APPDATA%\AutoResume\` |
| macOS | `~/Library/Application Support/AutoResume/` |
| Linux | `~/.local/share/AutoResume/` |

卸载或重装应用都不会清掉数据；想重新登录某账号就删对应的 `profiles/<task_id>/` 即可。

## 直接下载可运行包

https://github.com/wangrujun2016/auto-resume-package
