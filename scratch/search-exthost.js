const fs = require('fs');
const path = require('path');

function searchDir(dir, query, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'out') {
        searchDir(full, query, results);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes(query)) {
        results.push(full);
      }
    }
  }
  return results;
}

const targetDir = path.join(__dirname, '..', 'src', 'vs');
console.log('Searching in:', targetDir);
const resIPC = searchDir(targetDir, 'IPCExtHostConnection');
console.log('IPCExtHostConnection found in:', resIPC);

const resHook = searchDir(targetDir, 'VSCODE_EXTHOST_IPC_HOOK');
console.log('VSCODE_EXTHOST_IPC_HOOK found in:', resHook);

const resStarter = searchDir(targetDir, 'ExtensionHostStarter');
console.log('ExtensionHostStarter found in:', resStarter);
