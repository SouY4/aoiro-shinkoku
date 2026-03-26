/**
 * Electron パッケージ用に Next standalone 出力を next-app にコピーする
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'next-app');

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dst, name));
    }
  } else {
    const dir = path.dirname(dst);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}
fs.mkdirSync(dest, { recursive: true });

// 1. standalone出力（server.js + 最小限のnode_modules）
console.log('Copy standalone');
copyRecursive(path.join(root, '.next', 'standalone'), dest);

// 2. 静的ファイル（standaloneには含まれないため手動コピー）
console.log('Copy .next/static');
copyRecursive(
  path.join(root, '.next', 'static'),
  path.join(dest, '.next', 'static')
);

// 3. publicディレクトリ
console.log('Copy public');
copyRecursive(path.join(root, 'public'), path.join(dest, 'public'));

// 4. prisma（スキーマ・マイグレーション）
console.log('Copy prisma');
for (const item of ['schema.prisma', 'migrations', 'seed.js']) {
  const src = path.join(root, 'prisma', item);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(dest, 'prisma', item));
  }
}

// 5. dataディレクトリ（DBファイル置き場）
const dataDir = path.join(root, 'data');
if (fs.existsSync(dataDir)) {
  console.log('Copy data');
  copyRecursive(dataDir, path.join(dest, 'data'));
} else {
  fs.mkdirSync(path.join(dest, 'data'), { recursive: true });
}

// 6. ネイティブモジュール（.nodeファイル）をstandalone/node_modulesに追加
// standaloneはJSのみトレースするため、.nodeバイナリは手動コピーが必要
console.log('Copy native .node files');
function copyNativeFiles(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  let entries;
  try { entries = fs.readdirSync(srcDir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyNativeFiles(srcPath, dstPath);
    } else if (entry.name.endsWith('.node')) {
      if (!fs.existsSync(path.dirname(dstPath))) {
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      }
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}
copyNativeFiles(path.join(root, 'node_modules'), path.join(dest, 'node_modules'));

console.log('next-app ready');
