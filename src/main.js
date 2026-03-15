const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0f111a',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset'
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    for (const proc of terminalProcesses.values()) {
      proc.kill();
    }
    terminalProcesses.clear();
    mainWindow = null;
  });
}

// IPC handlers for file operations
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Cimple', extensions: ['cimple', 'cpl', 'py'] }, { name: 'All Files', extensions: ['*'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('save-file', async (_, filePath, content) => {
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Cimple', extensions: ['cimple', 'cpl', 'py'] }, { name: 'All Files', extensions: ['*'] }]
    });
    if (result.canceled) return null;
    filePath = result.filePath;
  }
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
});

ipcMain.handle('read-file', async (_, filePath) => {
  if (typeof filePath !== 'string') throw new Error('Invalid filePath');
  return fs.readFile(filePath, 'utf8');
});

ipcMain.handle('read-dir', async (_, dirPath) => {
  if (typeof dirPath !== 'string') throw new Error('Invalid dirPath');
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }));
});

ipcMain.handle('write-file', async (_, filePath, content) => {
  if (typeof filePath !== 'string') throw new Error('Invalid filePath');
  await fs.writeFile(filePath, content, 'utf8');
});

ipcMain.handle('file-exists', async (_, filePath) => {
  if (typeof filePath !== 'string') return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('create-temp-file', async (_, content) => {
  const tmpPath = path.join(os.tmpdir(), `cimple_run_${Date.now()}.cimple`);
  await fs.writeFile(tmpPath, content || '', 'utf8');
  return tmpPath;
});

ipcMain.handle('delete-file', async (_, filePath) => {
  if (typeof filePath !== 'string') return false;
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
});

const terminalProcesses = new Map();
const fallbackShell = process.platform === 'win32'
  ? (process.env.POWERSHELL || process.env.COMSPEC || 'powershell.exe')
  : (process.env.SHELL || '/bin/bash');
const fallbackIsPowerShell = /powershell|pwsh/i.test(fallbackShell);
const fallbackIsCmd = /cmd(?:\\.exe)?$/i.test(fallbackShell);
const fallbackArgs = fallbackIsPowerShell ? ['-NoLogo', '-NoExit'] : (fallbackIsCmd ? ['/K'] : []);

function spawnTerminalProcess(sessionId, options = {}) {
  const shellCommand = options.shell || fallbackShell;
  const args = Array.isArray(options.args) && options.args.length ? options.args : fallbackArgs;
  if (terminalProcesses.has(sessionId)) {
    const prev = terminalProcesses.get(sessionId);
    prev.kill();
    terminalProcesses.delete(sessionId);
  }
  const cwd = options.cwd || process.cwd();
  const proc = spawn(shellCommand, args, {
    cwd,
    env: process.env
  });
  terminalProcesses.set(sessionId, proc);
  proc.stdout.on('data', (data) => {
    mainWindow?.webContents?.send('terminal-data', { sessionId, data: data.toString() });
  });
  proc.stderr.on('data', (data) => {
    mainWindow?.webContents?.send('terminal-data', { sessionId, data: data.toString() });
  });
  proc.on('exit', (code) => {
    terminalProcesses.delete(sessionId);
    mainWindow?.webContents?.send('terminal-exit', { sessionId, code });
  });
  return proc;
}

ipcMain.handle('terminal-spawn', async (_, options = {}) => {
  const sessionId = options.sessionId;
  if (!sessionId) throw new Error('Missing sessionId');
  spawnTerminalProcess(sessionId, options);
  return { pid: terminalProcesses.get(sessionId)?.pid };
});

ipcMain.handle('terminal-write', (_, payload) => {
  const sessionId = payload?.sessionId;
  const command = payload?.command;
  const proc = terminalProcesses.get(sessionId);
  if (proc && proc.stdin.writable) {
    proc.stdin.write(command);
  }
});

ipcMain.handle('terminal-kill', (_, payload) => {
  const sessionId = payload?.sessionId;
  const proc = terminalProcesses.get(sessionId);
  if (proc) {
    proc.kill();
    terminalProcesses.delete(sessionId);
  }
});

ipcMain.handle('terminal-sigint', (_, payload) => {
  const sessionId = payload?.sessionId;
  const proc = terminalProcesses.get(sessionId);
  if (proc) {
    proc.kill('SIGINT');
  }
});

// Git
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

ipcMain.handle('git-branch', async (_, cwd) => {
  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: cwd || process.cwd() });
    return stdout.trim() || null;
  } catch {
    return null;
  }
});

ipcMain.handle('git-status', async (_, cwd) => {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: cwd || process.cwd() });
    return stdout || '';
  } catch {
    return '';
  }
});

ipcMain.handle('git-is-repo', async (_, cwd) => {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: cwd || process.cwd() });
    return true;
  } catch {
    return false;
  }
});

// Run Cimple (placeholder - user replaces 'python' with cimple compiler path)
ipcMain.handle('run-cimple', async (_, filePath, options = {}) => {
  const entry = filePath || '';
  const args = Array.isArray(options.args) ? options.args : [];
  const cmd = process.platform === 'win32' ? 'python' : 'python3';
  const dir = options.cwd || (entry ? path.dirname(entry) : process.cwd()) || process.cwd();
  const env = { ...process.env, ...(options.env || {}) };
  return new Promise((resolve, reject) => {
    const spawnArgs = entry ? [entry, ...args] : [...args];
    const proc = spawn(cmd, spawnArgs, {
      cwd: dir,
      env
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d; mainWindow?.webContents?.send('run-output', d.toString()); });
    proc.stderr.on('data', (d) => { err += d; mainWindow?.webContents?.send('run-output', d.toString()); });
    proc.on('close', (code) => resolve({ code, stdout: out, stderr: err, entryPath: entry, args, cwd: dir }));
    proc.on('error', reject);
  });
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  for (const proc of terminalProcesses.values()) {
    proc.kill();
  }
  terminalProcesses.clear();
  if (process.platform !== 'darwin') app.quit();
});
