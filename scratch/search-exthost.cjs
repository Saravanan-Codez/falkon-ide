const fs = require('fs');
const path = require('path');

function searchDir(dir, query, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'out' && entry.name !== 'dist') {
          searchDir(full, query, results);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes(query)) {
            results.push(full);
          }
        } catch (_e) {}
      }
    }
  } catch (_e) {}
  return results;
}

const targetDir = path.normalize('d:/Falkon_labs/falkon-ide/src/vs');
console.log('Searching in:', targetDir);

console.log('--- IPCExtHostConnection ---');
console.log(searchDir(targetDir, 'IPCExtHostConnection'));

console.log('--- VSCODE_EXTHOST_IPC_HOOK ---');
console.log(searchDir(targetDir, 'VSCODE_EXTHOST_IPC_HOOK'));

console.log('--- extensionHostStarter ---');
console.log(searchDir(targetDir, 'extensionHostStarter'));
