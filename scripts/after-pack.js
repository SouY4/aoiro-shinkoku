/**
 * electron-builder afterPack フック
 * electron-builder が native モジュールを Electron 用に再ビルドした後に
 * 再ビルド済みの .node ファイルをリソース内の全パスに上書きコピーする
 * (pnpm のフラット構造・スタンドアロン出力の両方に対応)
 */
const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  // Mac はアプリバンドル構造が異なる
  const platform = context.packager.platform.nodeName; // 'darwin' | 'win32' | 'linux'
  let resourcesBase;
  if (platform === 'darwin') {
    const appName = context.packager.appInfo.productFilename;
    resourcesBase = path.join(context.appOutDir, `${appName}.app`, 'Contents', 'Resources');
  } else {
    resourcesBase = path.join(context.appOutDir, 'resources');
  }

  const srcNodeModules = path.join(__dirname, '..', 'node_modules');

  // Step 1: ファイル名 → 再ビルド済みパス のマップを作成
  // pnpm シンボリックリンクをスキップして実体ファイルのみ収集
  const rebuiltNodes = new Map(); // filename -> absolute path

  function collectRebuilt(dir) {
    if (!fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        collectRebuilt(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.node')) {
        // 同名ファイルが複数ある場合は最初に見つけたものを優先
        if (!rebuiltNodes.has(entry.name)) {
          rebuiltNodes.set(entry.name, path.join(dir, entry.name));
        }
      }
    }
  }

  // Step 2: パッケージ済みアプリ内の全 .node ファイルを置き換え
  function replaceAll(dir) {
    if (!fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        replaceAll(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.node')) {
        const rebuilt = rebuiltNodes.get(entry.name);
        if (rebuilt) {
          const target = path.join(dir, entry.name);
          fs.copyFileSync(rebuilt, target);
          console.log('afterPack: replaced', entry.name, 'at', path.relative(resourcesBase, target));
        } else {
          console.log('afterPack: no rebuild for', entry.name, '(skipping)');
        }
      }
    }
  }

  console.log('afterPack: collecting rebuilt native modules from', srcNodeModules);
  collectRebuilt(srcNodeModules);
  console.log('afterPack: found:', [...rebuiltNodes.keys()].join(', '));

  console.log('afterPack: replacing native modules in', resourcesBase);
  replaceAll(resourcesBase);
  console.log('afterPack: done');
};
