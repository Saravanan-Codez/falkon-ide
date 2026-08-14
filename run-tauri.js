import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const action = args[0] || 'dev';
const extraArgs = args.slice(1);

const env = { ...process.env };

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
  const injectedPath = `${msvcBin};${origPath}`;
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
}

const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

const tauriArgs = ['tauri', action, ...extraArgs];

// On Linux, default build targets to deb,rpm if not explicitly specified
if (action === 'build' && isLinux && !extraArgs.some(a => a === '--bundles' || a === '-b')) {
  tauriArgs.push('--bundles', 'deb,rpm');
}

console.log(`🚀 Starting Tauri: ${tauriArgs.join(' ')}...`);

let child;
if (isWin) {
  const comspec = process.env.ComSpec || process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
  child = spawn(comspec, ['/d', '/s', '/c', 'npx.cmd', ...tauriArgs], {
    stdio: 'inherit',
    env,
  });
} else {
  child = spawn('npx', tauriArgs, { stdio: 'inherit', env });
}

child.on('exit', (code) => {
  process.exit(code || 0);
});
