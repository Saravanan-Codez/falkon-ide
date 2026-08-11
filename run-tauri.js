import { spawn } from 'child_process';

const action = process.argv[2] || 'dev';
const env = { ...process.env };

// Unset Linux-specific variables if they exist
delete env.LD_LIBRARY_PATH;
delete env.GTK_PATH;

console.log(`🚀 Starting Tauri in ${action} mode...`);

const isWin = process.platform === 'win32';

const child = isWin
  ? spawn('npx.cmd', ['tauri', action], { stdio: 'inherit', env, shell: true })
  : spawn('npx', ['tauri', action], { stdio: 'inherit', env });

child.on('exit', (code) => {
  process.exit(code || 0);
});
