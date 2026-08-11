import { execSync } from 'child_process';
import * as fs from 'fs';

function run(cmd, opts = {}) {
  console.log(`\x1b[36m> ${cmd}\x1b[0m`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function syncUpstream() {
  const targetTag = process.argv[2] || 'latest';
  console.log(`\n🚀 Starting Upstream VS Code Sync Workflow (Target: ${targetTag})\n`);

  try {
    // 1. Ensure upstream remote exists
    const remotes = execSync('git remote', { encoding: 'utf8' });
    if (!remotes.includes('upstream')) {
      console.log('Adding upstream remote (https://github.com/microsoft/vscode.git)...');
      run('git remote add upstream https://github.com/microsoft/vscode.git');
    }

    // 2. Fetch upstream tags and branches
    console.log('Fetching upstream releases...');
    run('git fetch upstream --tags');

    // 3. Checkout or create dev-updates branch
    console.log('Switching to dev-updates branch...');
    try {
      run('git checkout dev-updates');
    } catch {
      run('git checkout -b dev-updates');
    }

    // 4. Merge target release into dev-updates
    const mergeTarget = targetTag === 'latest' ? 'upstream/main' : targetTag;
    console.log(`Merging ${mergeTarget} into dev-updates...`);
    run(`git merge ${mergeTarget} --no-edit`);

    // 5. Install dependencies and verify build
    console.log('\nInstalling dependencies...');
    run('npm install');

    console.log('\nBundling VS Code Workbench...');
    run('npm run bundle-vs');

    console.log('\nChecking Rust Backend...');
    run('cargo check --manifest-path src-tauri/Cargo.toml');

    console.log(`
\x1b[32m✅ Upstream sync successfully merged into dev-updates and validated!\x1b[0m

\x1b[1mNext Steps in Workflow:\x1b[0m
1. Push branch: \x1b[33mgit push origin dev-updates\x1b[0m
2. Open Pull Request: \x1b[33mdev-updates -> dev\x1b[0m
3. Battle test in PR environment.
4. Merge \x1b[33mdev -> main\x1b[0m for production release.
`);
  } catch (err) {
    console.error('\x1b[31m❌ Upstream sync failed:\x1b[0m', err.message);
    process.exit(1);
  }
}

syncUpstream();
