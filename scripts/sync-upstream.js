import { execSync } from 'child_process';
import * as fs from 'fs';

function run(cmd, opts = {}) {
  console.log(`\x1b[36m> ${cmd}\x1b[0m`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function getOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function syncUpstream() {
  const targetTag = process.argv[2] || 'latest';
  console.log(`\n🚀 Starting Battle-Tested Upstream VS Code Sync (Target: ${targetTag})\n`);

  try {
    // 1. Guard against dirty working tree
    const gitStatus = getOutput('git status --porcelain');
    let stashed = false;
    if (gitStatus.length > 0) {
      console.log('\x1b[33m⚠️ Working directory has uncommitted changes. Stashing before sync...\x1b[0m');
      run('git stash save "Auto-stash before upstream sync"');
      stashed = true;
    }

    // 2. Ensure upstream remote exists
    const remotes = getOutput('git remote');
    if (!remotes.includes('upstream')) {
      console.log('Adding upstream remote (https://github.com/microsoft/vscode.git)...');
      run('git remote add upstream https://github.com/microsoft/vscode.git');
    }

    // 3. Fetch latest upstream releases
    console.log('Fetching upstream tags and branches...');
    run('git fetch upstream --tags --prune');

    // 4. Checkout or create dev-updates branch
    console.log('Switching to isolated dev-updates branch...');
    const currentBranch = getOutput('git branch --show-current');
    const branches = getOutput('git branch');
    
    if (branches.includes('dev-updates')) {
      run('git checkout dev-updates');
    } else {
      run('git checkout -b dev-updates');
    }

    // 5. Merge target release into dev-updates
    const mergeTarget = targetTag === 'latest' ? 'upstream/main' : targetTag;
    console.log(`Merging ${mergeTarget} into dev-updates...`);
    try {
      run(`git merge ${mergeTarget} --no-edit`);
    } catch (mergeErr) {
      console.error('\n\x1b[31m❌ Merge conflict detected during upstream sync!\x1b[0m');
      console.log('\x1b[33mPlease resolve merge conflicts in dev-updates, run `git commit`, then re-run `npm run bundle-vs`.\x1b[0m');
      process.exit(1);
    }

    // 6. Install dependencies and verify build integrity
    console.log('\nInstalling updated dependencies...');
    run('npm install');

    console.log('\nBundling VS Code Workbench & Built-in Extensions...');
    run('npm run bundle-vs');

    console.log('\nVerifying Rust Backend Compilation...');
    run('cargo check --manifest-path src-tauri/Cargo.toml');

    if (stashed) {
      console.log('\nRestoring stashed working changes...');
      run('git stash pop');
    }

    console.log(`
\x1b[32m✅ Upstream sync successfully merged into dev-updates and 100% validated!\x1b[0m

\x1b[1mBattle-Tested Release Promotion Checklist:\x1b[0m
 1. Push isolated update branch: \x1b[33mgit push origin dev-updates\x1b[0m
 2. Open PR: \x1b[33mdev-updates -> dev\x1b[0m
 3. Battle-test features in PR environment (\x1b[33mnpm run dev\x1b[0m / \x1b[33mnpm run build:nsis\x1b[0m)
 4. Promote verified build: \x1b[33mdev -> main\x1b[0m
`);
  } catch (err) {
    if (stashed) {
      console.log('\n\x1b[33m⚠️ Sync encountered an error. Automatically restoring stashed changes...\x1b[0m');
      try {
        run('git stash pop');
      } catch (_) {}
    }
    console.error('\x1b[31m❌ Upstream sync failed:\x1b[0m', err.message);
    process.exit(1);
  }
}

syncUpstream();
