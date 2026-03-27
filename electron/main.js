const { app, BrowserWindow, shell, utilityProcess } = require('electron');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;
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

function startNextServer(port) {
  serverPort = port;
  return new Promise((resolve, reject) => {
    const appPath = getNextAppPath();
    const dataDir = path.join(appPath, 'data');
    const dbPath = path.join(dataDir, 'database.sqlite');
    const env = {
      ...process.env,
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: process.env.DATABASE_URL || `file:${dbPath}`,
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
      // ユーザー環境に Node.js がインストールされていなくても動作する
      const serverJs = path.join(appPath, 'server.js');
      nextProcess = utilityProcess.fork(serverJs, [], {
        cwd: appPath, env, stdio: 'pipe',
      });
      nextProcess.stdout.on('data', (d) => {
        if (d.toString().includes('Ready') && !resolved) { resolved = true; resolve(); }
      });
      nextProcess.stderr.on('data', (d) => {
        if (d.toString().includes('Ready') && !resolved) { resolved = true; resolve(); }
      });
      nextProcess.on('exit', (code) => {
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
  const fs = require('fs');
  try {
    const appPath = getNextAppPath();
    // dataディレクトリが存在することを確認（DBはビルド時に同梱済み）
    const dataDir = path.join(appPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const port = isDev ? serverPort : await getAvailablePort(serverPort);
    await startNextServer(port);
    createWindow();
  } catch (err) {
    console.error('Failed to start Next.js:', err);
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
