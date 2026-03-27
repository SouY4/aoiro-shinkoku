/**
 * electron-builder afterPack フック
 * electron-builder が native モジュールを Electron 用に再ビルドした後に
 * 再ビルド済みの .node ファイルをリソース内の next-app に上書きコピーする
 */
const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  const appNodeModules = path.join(context.appOutDir, 'resources', 'app', 'node_modules');
  const srcNodeModules = path.join(__dirname, '..', 'node_modules');

  if (!fs.existsSync(appNodeModules)) {
    console.log('afterPack: app/node_modules not found, skipping native copy');
    return;
  }

  function copyNodeFiles(src, dst) {
    if (!fs.existsSync(src)) return;
    let entries;
    try { entries = fs.readdirSync(src, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        copyNodeFiles(path.join(src, entry.name), path.join(dst, entry.name));
      } else if (entry.name.endsWith('.node')) {
        const dstFile = path.join(dst, entry.name);
        fs.mkdirSync(path.dirname(dstFile), { recursive: true });
        fs.copyFileSync(path.join(src, entry.name), dstFile);
      }
    }
  }

  console.log('afterPack: copying rebuilt native modules...');
  copyNodeFiles(srcNodeModules, appNodeModules);
  console.log('afterPack: done');
};
