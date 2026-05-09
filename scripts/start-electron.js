const { spawn } = require('child_process');

const electronPath = require('electron');
const env = { ...process.env };

// Ensure Electron runs in normal mode even if the parent shell set it.
delete env.ELECTRON_RUN_AS_NODE;

defineExitHandler();

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

function defineExitHandler() {
  process.on('SIGINT', () => process.exit(130));
  process.on('SIGTERM', () => process.exit(143));
}
