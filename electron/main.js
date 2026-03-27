const { app, BrowserWindow, shell, utilityProcess } = require('electron');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const fs = require('fs');

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

// ログファイル（パッケージ版のデバッグ用）
let logStream = null;
function setupLog() {
  if (isDev) return;
  const logDir = app.getPath('logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'main.log');
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n--- startup ${new Date().toISOString()} ---\n`);
}
function log(...args) {
  const msg = args.join(' ');
  console.log(msg);
  if (logStream) logStream.write(msg + '\n');
}
let nextProcess = null;
// Electron 開発時は普段使われないポートを固定で使用（3000 との競合・ロック競合を防ぐ）
const ELECTRON_DEV_PORT = 39452;
let serverPort = isDev ? ELECTRON_DEV_PORT : (parseInt(process.env.PORT, 10) || 3000);

/** 本番パッケージ時のみ：使用可能なポートを 1 つ取得 */
function getAvailablePort(startPort) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const s = net.createServer();
      s.once('error', () => tryPort(port + 1));
      s.once('listening', () => {
        s.close(() => resolve(port));
      });
      s.listen(port, '::');
    };
    tryPort(startPort || 3000);
  });
}

function getNextAppPath() {
  if (isDev) {
    return path.join(__dirname, '..');
  }
  return path.join(process.resourcesPath, 'app');
}

function getUserDataDbPath() {
  // AppData/Roaming/AoiroShinkoku/database.sqlite
  // Electron アプリと MCP サーバーが同じ DB を共有するための固定パス
  const userDataDir = app.getPath('userData');
  return path.join(userDataDir, 'database.sqlite');
}

function startNextServer(port) {
  serverPort = port;
  return new Promise((resolve, reject) => {
    const appPath = getNextAppPath();
    const dbPath = isDev
      ? path.join(appPath, 'data', 'database.sqlite')
      : getUserDataDbPath();
    const receiptsDir = isDev
      ? path.join(appPath, 'data', 'receipts')
      : path.join(app.getPath('userData'), 'receipts');
    const env = {
      ...process.env,
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: process.env.DATABASE_URL || `file:${dbPath}`,
      RECEIPTS_DIR: receiptsDir,
    };

    let resolved = false;
    const tryConnect = () => {
      const http = require('http');
      const req = http.get(`http://127.0.0.1:${port}`, () => {
        if (!resolved) { resolved = true; resolve(); }
      });
      req.on('error', () => { if (!resolved) setTimeout(tryConnect, 300); });
      req.setTimeout(1000, () => req.destroy());
    };

    if (isDev) {
      // 開発時: システムの node を使って next dev を起動
      const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
      const nextBin = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');
      nextProcess = spawn(nodeCmd, [nextBin, 'dev', '--port', String(port), '--hostname', '127.0.0.1'], {
        cwd: appPath, env, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderrLog = '';
      nextProcess.stdout.on('data', (d) => {
        if (d.toString().includes('Ready') && !resolved) { resolved = true; resolve(); }
      });
      nextProcess.stderr.on('data', (d) => {
        const s = d.toString(); stderrLog += s;
        if (s.includes('Ready') && !resolved) { resolved = true; resolve(); }
      });
      nextProcess.on('error', (err) => { if (!resolved) { resolved = true; reject(err); } });
      nextProcess.on('exit', (code) => {
        if (code && !resolved) { resolved = true; reject(new Error(`Next.js exited: ${code}\n${stderrLog}`)); }
      });
      setTimeout(() => { if (!resolved) tryConnect(); }, 5000);
    } else {
      // 本番: Electron 組み込みの Node.js (utilityProcess) で server.js を起動
      const serverJs = path.join(appPath, 'server.js');
      log('server.js path:', serverJs);
      log('server.js exists:', fs.existsSync(serverJs));
      log('appPath:', appPath);
      log('dbPath:', dbPath, 'exists:', fs.existsSync(dbPath));

      nextProcess = utilityProcess.fork(serverJs, [], {
        cwd: appPath, env, stdio: 'pipe',
      });
      nextProcess.stdout.on('data', (d) => {
        log('[server stdout]', d.toString().trim());
        if (d.toString().includes('Ready') && !resolved) { resolved = true; resolve(); }
      });
      nextProcess.stderr.on('data', (d) => {
        log('[server stderr]', d.toString().trim());
        if (d.toString().includes('Ready') && !resolved) { resolved = true; resolve(); }
      });
      nextProcess.on('exit', (code) => {
        log('server.js exited with code:', code);
        if (code && !resolved) { resolved = true; reject(new Error(`server.js exited: ${code}`)); }
      });
      setTimeout(() => { if (!resolved) tryConnect(); }, 2000);
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    show: false,
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win.destroy(); });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const url = `http://127.0.0.1:${serverPort}`;
  win.loadURL(url);
}

app.whenReady().then(async () => {
  setupLog();
  try {
    const appPath = getNextAppPath();
    log('appPath:', appPath);
    log('isDev:', isDev);
    // DBはAppData配下に配置（MCP・Electronで共有、再インストールでデータ消えない）
    const dbPath = getUserDataDbPath();
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    // 初回起動時: バンドルされた初期化済みDBをコピー
    if (!fs.existsSync(dbPath)) {
      const templateDb = path.join(appPath, 'data', 'database.sqlite');
      if (fs.existsSync(templateDb)) {
        fs.copyFileSync(templateDb, dbPath);
        log('Copied template DB to', dbPath);
      }
    }
    const port = isDev ? serverPort : await getAvailablePort(serverPort);
    log('port:', port);
    await startNextServer(port);
    log('server started, creating window');
    createWindow();
  } catch (err) {
    log('ERROR:', err.message, err.stack);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
  app.quit();
});
