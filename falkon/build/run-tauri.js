import { spawn, execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const action = args[0] || 'dev';
const extraArgs = args.slice(1);

const env = { ...process.env };

// Auto-kill any stale running instance of falkon_ide.exe to release binary file lock
if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM falkon_ide.exe /T', { stdio: 'ignore' });
  } catch (_) {}
}

// ── Inject MSVC + Windows SDK paths ──────────────────────────────────────────
function findMsvc() {
  if (process.platform !== 'win32') return null;
  const vsPaths = [
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools',
  ];
  for (const vsDir of vsPaths) {
    const msvcBase = join(vsDir, 'VC', 'Tools', 'MSVC');
    if (existsSync(msvcBase)) {
      const versions = readdirSync(msvcBase);
      if (versions.length > 0) {
        const latest = versions.sort().pop();
        return { vsDir, msvcDir: join(msvcBase, latest) };
      }
    }
  }
  return null;
}

const msvcInfo = findMsvc();
if (msvcInfo) {
  console.log('🔧 Injecting MSVC + Windows SDK paths from:', msvcInfo.vsDir);
  const msvcBin = join(msvcInfo.msvcDir, 'bin', 'HostX64', 'x64');
  const msvcLib = join(msvcInfo.msvcDir, 'lib', 'x64');
  const msvcInc = join(msvcInfo.msvcDir, 'include');

  const WIN_SDK = 'C:\\Program Files (x86)\\Windows Kits\\10\\Lib\\10.0.26100.0';
  const WIN_INC = 'C:\\Program Files (x86)\\Windows Kits\\10\\Include\\10.0.26100.0';
  const sdkUmLib = join(WIN_SDK, 'um', 'x64');
  const sdkUcLib = join(WIN_SDK, 'ucrt', 'x64');
  const sdkUcInc = join(WIN_INC, 'ucrt');
  const sdkUmInc = join(WIN_INC, 'um');
  const sdkShInc = join(WIN_INC, 'shared');

  const origPath = env.PATH || env.Path || env.path || process.env.PATH || process.env.Path || '';
  const sys32 = 'C:\\Windows\\System32';
  const injectedPath = `${msvcBin};${sys32};${origPath}`;
  env.PATH = injectedPath;
  env.Path = injectedPath;

  const origLib = env.LIB || env.Lib || process.env.LIB || '';
  env.LIB = [msvcLib, sdkUmLib, sdkUcLib, origLib].filter(Boolean).join(';');
  env.Lib = env.LIB;

  const origInc = env.INCLUDE || env.Include || process.env.INCLUDE || '';
  env.INCLUDE = [msvcInc, sdkUcInc, sdkUmInc, sdkShInc, origInc].filter(Boolean).join(';');
  env.Include = env.INCLUDE;
  env.VSINSTALLDIR = msvcInfo.vsDir;
  env.VCINSTALLDIR = join(msvcInfo.vsDir, 'VC');
} else if (process.platform === 'win32') {
  console.warn('⚠️ MSVC Build Tools not found at standard paths. Cargo will use system PATH.');
}

// Unset Linux-specific variables if they exist
delete env.LD_LIBRARY_PATH;
delete env.GTK_PATH;

if (process.platform === 'linux') {
  env.APPIMAGE_EXTRACT_AND_RUN = '1';
  env.NO_STRIP = 'true';
  env.GIO_USE_VFS = 'local';
  env.GIO_USE_VOLUME_MONITOR = 'unix';
}

import { fetchPortableNode } from './fetch-node-runtime.js';

const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

const isStandalone = extraArgs.some(a => a === '--standalone' || a === '-s');
const isArchTarget = extraArgs.some(a => a === 'arch' || a === 'pacman');
const filteredExtraArgs = extraArgs.filter(a => a !== 'arch' && a !== 'pacman' && a !== '--standalone' && a !== '-s');

const tauriArgs = [action, ...filteredExtraArgs];

// If standalone mode requested (for dev or build), ensure portable Node runtime is present and prioritized
if (isStandalone) {
  const nodeBin = await fetchPortableNode();
  if (nodeBin) {
    const nodeBinDir = path.dirname(nodeBin);
    env.PATH = isWin ? `${nodeBinDir};${env.PATH || ''}` : `${nodeBinDir}:${env.PATH || ''}`;
    env.Path = env.PATH;
    console.log(`⚡ Standalone Mode: Prioritizing Node.js runtime at ${nodeBin}`);
  }
}

// On Linux, default build targets to deb,rpm if not explicitly specified
if (action === 'build' && isLinux && !filteredExtraArgs.some(a => a === '--bundles' || a === '-b')) {
  tauriArgs.push('--bundles', 'deb,rpm');
}

// ── Inject System Git Paths ──────────────────────────────────────────────────
const gitPaths = [
  'C:\\Program Files\\Git\\cmd',
  'C:\\Program Files\\Git\\bin',
  'C:\\Program Files (x86)\\Git\\cmd',
];
for (const gitPath of gitPaths) {
  if (existsSync(gitPath) && !(env.PATH || '').includes(gitPath)) {
    env.PATH = `${gitPath};${env.PATH || ''}`;
    env.Path = env.PATH;
  }
}

// ── Start Stock VS Code Node.js Server Sidecar ──────────────────────────────
const candidateServerPaths = [
  join(__dirname, '../../src', 'server-main.js'),
  join(__dirname, '../../out', 'server-main.js'),
];
const serverEntryPoint = candidateServerPaths.find(p => existsSync(p));

if (serverEntryPoint) {
  try {
    let res = await fetch('http://127.0.0.1:9888/').catch(() => null);
    if (res && res.status === 200) {
      console.log('⚡ Stock VS Code Node.js Server Sidecar is already running on port 9888.');
    } else {
      const serverProc = spawn(process.execPath, [
        serverEntryPoint,
        '--host', '127.0.0.1',
        '--port', '9888',
        '--builtin-extensions-dir', join(__dirname, '../../extensions'),
        '--accept-server-license-terms',
        '--without-connection-token'
      ], {
        env,
        stdio: ['ignore', 'pipe', 'inherit']
      });
      process.on('exit', () => serverProc.kill());
      process.on('SIGINT', () => { serverProc.kill(); process.exit(0); });
      process.on('SIGTERM', () => { serverProc.kill(); process.exit(0); });

      // Poll until server is ready
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250));
        res = await fetch('http://127.0.0.1:9888/').catch(() => null);
        if (res && (res.status === 200 || res.status === 302 || res.status === 405)) {
          console.log('✅ VS Code Node.js Server Sidecar is ready on http://127.0.0.1:9888!');
          break;
        }
      }
    }
  } catch (_e) {
    console.warn('⚠️ Could not connect to VS Code Server Sidecar on port 9888.');
  }
}

const rootDir = join(__dirname, '../../');
const srcTauriDir = join(__dirname, '../../src-tauri');
const localTauriCli = join(rootDir, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

// Synchronously bundle VS Code workbench once before launching Tauri
if (action === 'dev' || action === 'build') {
  try {
    execSync(`node "${join(__dirname, 'bundle-vscode.js')}"`, {
      cwd: rootDir,
      stdio: 'inherit',
      env
    });
  } catch (bundleErr) {
    console.error('❌ Failed to bundle VS Code Workbench:', bundleErr.message);
    process.exit(1);
  }
}

let child;
if (action === 'test') {
  console.log('🚀 Running Cargo unit tests with MSVC environment...');
  if (isWin) {
    child = spawn('cargo', ['test'], {
      cwd: srcTauriDir,
      stdio: 'inherit',
      env,
      shell: true
    });
  } else {
    child = spawn('cargo', ['test'], { cwd: srcTauriDir, stdio: 'inherit', env });
  }
} else if (existsSync(localTauriCli)) {
  child = spawn(process.execPath, [localTauriCli, ...tauriArgs], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
    shell: isWin
  });
} else if (isWin) {
  child = spawn('npx.cmd', ['--yes', '@tauri-apps/cli', ...tauriArgs], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
    shell: true
  });
} else {
  child = spawn('npx', ['--yes', '@tauri-apps/cli', ...tauriArgs], { cwd: rootDir, stdio: 'inherit', env });
}

import { buildArchPackage } from './build-arch-pkg.js';

child.on('exit', async (code) => {
  if (code === 0 && action === 'build' && isLinux) {
    try {
      await buildArchPackage({ standalone: isStandalone });
    } catch (err) {
      console.error('⚠️ Arch package generation warning:', err.message);
    }
  }
  process.exit(code || 0);
});
