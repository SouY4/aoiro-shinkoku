/**
 * Electron パッケージ用に Next standalone 出力を next-app にコピーする
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'next-app');

function copyRecursive(src, dst) {
  fs.cpSync(src, dst, { recursive: true, verbatimSymlinks: true });
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

// 6. standalone が含まない Next.js 実行時依存モジュールを補完
// pnpm の strict モードでは styled-jsx がプロジェクトルートから resolve できないため
// next の実パス（シンボリックリンクを解決）から sibling ディレクトリを辿って探す
console.log('Copy missing runtime modules');
const missingModules = ['styled-jsx'];

// next の実パス → .pnpm/.../node_modules/ を取得
let pnpmSiblingDir = null;
try {
  const nextPkgLink = require.resolve('next/package.json', { paths: [root] });
  const nextPkgReal = fs.realpathSync(nextPkgLink);
  // nextPkgReal = .../.pnpm/next@x.x.x_.../node_modules/next/package.json
  pnpmSiblingDir = path.dirname(path.dirname(nextPkgReal));
  console.log('  pnpm sibling dir:', pnpmSiblingDir);
} catch (e) {
  console.warn('  Could not resolve next package:', e.message);
}

for (const mod of missingModules) {
  const destMod = path.join(dest, 'node_modules', mod);
  if (fs.existsSync(destMod)) {
    console.log(`  ${mod} already in standalone, skipping`);
    continue;
  }
  let srcMod = null;
  // pnpm sibling から探す
  if (pnpmSiblingDir) {
    const candidate = path.join(pnpmSiblingDir, mod);
    if (fs.existsSync(candidate)) srcMod = candidate;
  }
  // fallback: プロジェクト node_modules 内を再帰検索
  if (!srcMod) {
    const pnpmStore = path.join(root, 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmStore)) {
      for (const entry of fs.readdirSync(pnpmStore)) {
        const candidate = path.join(pnpmStore, entry, 'node_modules', mod);
        if (fs.existsSync(candidate)) { srcMod = candidate; break; }
      }
    }
  }
  if (srcMod) {
    copyRecursive(srcMod, destMod);
    console.log(`  Copied ${mod} from ${srcMod}`);
  } else {
    console.warn(`  Warning: ${mod} not found anywhere`);
  }
}

// ネイティブ .node ファイルは afterPack フック（scripts/after-pack.js）でコピーする
// electron-builder が Electron 用に再ビルドした後に上書きするため、ここでは不要

console.log('next-app ready');
