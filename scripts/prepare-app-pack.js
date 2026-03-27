/**
 * Electron パッケージ用に Next standalone 出力を next-app にコピーする
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'next-app');

function copyRecursive(src, dst) {
  // dereference: true でシンボリックリンクを実体ファイルとしてコピー
  // pnpm の .pnpm ストアへのリンクが切れないようにするため
  fs.cpSync(src, dst, { recursive: true, dereference: true });
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

// ネイティブ .node ファイルは afterPack フック（scripts/after-pack.js）でコピーする
// electron-builder が Electron 用に再ビルドした後に上書きするため、ここでは不要

console.log('next-app ready');
