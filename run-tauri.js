import { spawn } from 'child_process';

const args = process.argv.slice(2);
const action = args[0] || 'dev';
const extraArgs = args.slice(1);

const env = { ...process.env };

// Unset Linux-specific variables if they exist
delete env.LD_LIBRARY_PATH;
delete env.GTK_PATH;

console.log(`🚀 Starting Tauri: tauri ${action} ${extraArgs.join(' ')}...`);

const isWin = process.platform === 'win32';
const tauriArgs = ['tauri', action, ...extraArgs];

const child = isWin
  ? spawn('npx.cmd', tauriArgs, { stdio: 'inherit', env, shell: true })
  : spawn('npx', tauriArgs, { stdio: 'inherit', env });

child.on('exit', (code) => {
  process.exit(code || 0);
});
