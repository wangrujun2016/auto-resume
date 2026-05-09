/**
 * 当前阶段无需 Node 桥接，预留 preload 占位。
 * 后续如要暴露 IPC（如选择目录、退出登录清理 profile），在此扩展 contextBridge。
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('autoresume', {
  apiBase: 'http://127.0.0.1:8765',
});
