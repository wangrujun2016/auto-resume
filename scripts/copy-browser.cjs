/**
 * 把本机 patchright 浏览器二进制拷贝到 backend/dist/auto-resume-backend/ms-playwright，
 * 让 PyInstaller 打包后的 backend「装完即用」、无需联网下载。
 *
 * 各平台的源路径（patchright/playwright 默认）：
 *   - win32  : %LOCALAPPDATA%\ms-playwright
 *   - darwin : ~/Library/Caches/ms-playwright
 *   - linux  : ~/.cache/ms-playwright
 *
 * 选择拷贝的子目录：chromium-XXXX、ffmpeg-YYYY、winldd-ZZZZ（仅 Win）、.links。
 * 不拷 chromium_headless_shell（headless 模式才用，省 ~120MB）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveSrc() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Local');
    return path.join(local, 'ms-playwright');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  }
  return path.join(os.homedir(), '.cache', 'ms-playwright');
}

const SRC = resolveSrc();
const DST = path.join(__dirname, '..', 'backend', 'dist', 'auto-resume-backend', 'ms-playwright');

if (!fs.existsSync(SRC)) {
  console.error(`[copy-browser] 源目录不存在：${SRC}`);
  console.error('请先在 backend 里执行：python -m patchright install chromium');
  process.exit(1);
}

if (fs.existsSync(DST)) {
  console.log(`[copy-browser] 清理旧的 ${DST}`);
  fs.rmSync(DST, { recursive: true, force: true });
}
fs.mkdirSync(DST, { recursive: true });

const KEEP = (name) =>
  /^chromium-\d+$/.test(name) ||
  /^ffmpeg-\d+$/.test(name) ||
  /^winldd-\d+$/.test(name) ||
  name === '.links';

function copyRecursive(src, dst) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(src);
    try {
      fs.symlinkSync(target, dst);
    } catch (e) {
      // 软链创建失败时退化为复制（macOS 偶有跨卷情况）
      const real = fs.realpathSync(src);
      copyRecursive(real, dst);
    }
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      copyRecursive(path.join(src, f), path.join(dst, f));
    }
  } else {
    fs.copyFileSync(src, dst);
    if (process.platform !== 'win32') {
      try { fs.chmodSync(dst, stat.mode); } catch (_) {}
    }
  }
}

let total = 0;
for (const name of fs.readdirSync(SRC)) {
  if (!KEEP(name)) {
    console.log(`[copy-browser] 跳过 ${name}`);
    continue;
  }
  const sp = path.join(SRC, name);
  const dp = path.join(DST, name);
  console.log(`[copy-browser] 复制 ${name} ...`);
  copyRecursive(sp, dp);
  total += 1;
}

console.log(`[copy-browser] 完成，共 ${total} 项 → ${DST}`);
