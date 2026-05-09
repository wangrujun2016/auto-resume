/**
 * Electron 主进程。
 * - 开发期：直接连 vite dev server (5173)，后端由 npm dev:py 单独启动
 * - 生产期：spawn 打包好的 auto-resume-backend.exe（含 patchright + chromium）；renderer 加载 frontend/dist
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 8765;
const FRONTEND_URL_DEV = 'http://127.0.0.1:5173';

let mainWindow = null;
let pyProcess = null;

/**
 * 打包后的 backend 路径。electron-builder 会把 backend/dist/auto-resume-backend
 * 整个目录拷到 resources/backend，里面是 PyInstaller onedir 输出（含 ms-playwright）。
 * 开发期不进入此函数。
 */
function resolveBackendExePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'auto-resume-backend.exe');
  }
  // 非打包但 NODE_ENV !== 'development'（如手动测试）：用 backend/dist 下的产物
  return path.join(__dirname, '..', 'backend', 'dist', 'auto-resume-backend', 'auto-resume-backend.exe');
}

function startPythonBackend() {
  if (isDev) return;
  const exePath = resolveBackendExePath();
  if (!fs.existsSync(exePath)) {
    console.error('[backend] 未找到 backend exe，请先执行 npm run build:py');
    return;
  }
  pyProcess = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, AUTORESUME_PORT: String(BACKEND_PORT) },
  });
  pyProcess.stdout?.on('data', (b) => process.stdout.write(`[backend] ${b}`));
  pyProcess.stderr?.on('data', (b) => process.stderr.write(`[backend] ${b}`));
  pyProcess.on('exit', (code) => {
    console.log(`[backend] exited with ${code}`);
    pyProcess = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'BOSS 直聘 自动招呼助手',
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(FRONTEND_URL_DEV);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 打包后：renderer 走 frontend/dist 静态文件
    const indexHtml = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'frontend', 'dist', 'index.html')
      : path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    // electron-builder 默认会把 frontend/dist 打入 asar；通过 files 字段保证可读取
    mainWindow.loadFile(fs.existsSync(indexHtml) ? indexHtml : path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  startPythonBackend();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (pyProcess) {
    try { pyProcess.kill(); } catch (e) { /* noop */ }
  }
  if (process.platform !== 'darwin') app.quit();
});
