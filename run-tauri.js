import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const action = args[0] || 'dev';
const extraArgs = args.slice(1);

const env = { ...process.env };

// ── Inject MSVC + Windows SDK paths ──────────────────────────────────────────
// Tauri needs link.exe + kernel32.lib to compile the Rust backend.
// VS BuildTools 18 is installed in the non-standard "18" folder instead of "2022".
const MSVC_BASE = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Tools\\MSVC\\14.51.36231';
const WIN_SDK   = 'C:\\Program Files (x86)\\Windows Kits\\10\\Lib\\10.0.26100.0';
const WIN_INC   = 'C:\\Program Files (x86)\\Windows Kits\\10\\Include\\10.0.26100.0';

const msvcBin  = join(MSVC_BASE, 'bin', 'HostX64', 'x64');
const msvcLib  = join(MSVC_BASE, 'lib', 'x64');
const msvcInc  = join(MSVC_BASE, 'include');
const sdkUmLib = join(WIN_SDK, 'um', 'x64');
const sdkUcLib = join(WIN_SDK, 'ucrt', 'x64');
const sdkUcInc = join(WIN_INC, 'ucrt');
const sdkUmInc = join(WIN_INC, 'um');
const sdkShInc = join(WIN_INC, 'shared');

if (existsSync(msvcBin)) {
  console.log('🔧 Injecting MSVC + Windows SDK paths...');
  
  // Case-insensitive PATH lookup on Windows (env.Path vs env.PATH)
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

  // Tell VS detection where to find it (for tools that check env vars)
  env.vs2022_install = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools';
  env.VSCMD_VER = '17.14.36231';
} else {
  console.warn('⚠️  MSVC Build Tools not found at expected path. Cargo may fail to link.');
}

// Unset Linux-specific variables if they exist
delete env.LD_LIBRARY_PATH;
delete env.GTK_PATH;

console.log(`🚀 Starting Tauri: tauri ${action} ${extraArgs.join(' ')}...`);

const isWin = process.platform === 'win32';
const tauriArgs = ['tauri', action, ...extraArgs];

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
