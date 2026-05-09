/**
 * 把本机 patchright 浏览器二进制拷贝到 backend/dist/auto-resume-backend/ms-playwright，
 * 让 PyInstaller 打包后的 backend 装完即用、无需联网下载。
 *
 * 路径：%LOCALAPPDATA%/ms-playwright/{chromium-XXXX, ffmpeg-YYYY, winldd-ZZZZ, .links}
 */
const fs = require('fs');
const path = require('path');

const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
const SRC = path.join(LOCALAPPDATA, 'ms-playwright');
const DST = path.join(__dirname, '..', 'backend', 'dist', 'auto-resume-backend', 'ms-playwright');

if (!fs.existsSync(SRC)) {
  console.error(`[copy-browser] 源目录不存在：${SRC}`);
  console.error('请先在 backend 里运行：.venv\\Scripts\\python.exe -m patchright install chromium');
  process.exit(1);
}

if (fs.existsSync(DST)) {
  console.log(`[copy-browser] 清理旧的 ${DST}`);
  fs.rmSync(DST, { recursive: true, force: true });
}
fs.mkdirSync(DST, { recursive: true });

// 仅挑必要的子目录（headless_shell 是 headless 模式用的，可省略以省 ~120MB）
const KEEP = (name) => /^chromium-\d+$/.test(name) || /^ffmpeg-\d+$/.test(name) || /^winldd-\d+$/.test(name) || name === '.links';

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      copyRecursive(path.join(src, f), path.join(dst, f));
    }
  } else {
    fs.copyFileSync(src, dst);
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
