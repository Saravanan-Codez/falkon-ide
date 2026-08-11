import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const extensionsRoot = path.resolve('extensions');

const extensionConfigs = [
  // Git & SCM
  { dir: 'git', entries: { 'out/main.js': 'src/main.ts', 'out/askpass-main.js': 'src/askpass-main.ts', 'out/git-editor-main.js': 'src/git-editor-main.ts' } },
  { dir: 'git-base', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'github', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'github-authentication', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'microsoft-authentication', entries: { 'out/extension.js': 'src/extension.ts' } },

  // Languages & IntelliSense
  { dir: 'typescript-language-features', entries: { 'out/extension.js': 'src/extension.ts', 'out/extension.browser.js': 'src/extension.browser.ts' } },
  { dir: 'markdown-language-features', entries: { 'out/extension.js': 'src/extension.ts', 'out/extension.browser.js': 'src/extension.browser.ts' } },
  { dir: 'markdown-math', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'mermaid-markdown-features', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'emmet', entries: { 'out/node/emmetNodeMain.js': 'src/node/emmetNodeMain.ts' } },
  { dir: 'configuration-editing', entries: { 'out/configurationEditingMain.js': 'src/configurationEditingMain.ts' } },
  { dir: 'extension-editing', entries: { 'out/extensionEditingMain.js': 'src/extensionEditingMain.ts' } },
  { dir: 'json-language-features', entries: { 'client/out/node/jsonClientMain.js': 'client/src/node/jsonClientMain.ts', 'server/out/node/jsonServerMain.js': 'server/src/node/jsonServerMain.ts' } },
  { dir: 'html-language-features', entries: { 'client/out/node/htmlClientMain.js': 'client/src/node/htmlClientMain.ts', 'server/out/node/htmlServerMain.js': 'server/src/node/htmlServerMain.ts' } },
  { dir: 'css-language-features', entries: { 'client/out/node/cssClientMain.js': 'client/src/node/cssClientMain.ts', 'server/out/node/cssServerMain.js': 'server/src/node/cssServerMain.ts' } },
  { dir: 'php-language-features', entries: { 'out/phpMain.js': 'src/phpMain.ts' } },
  { dir: 'ipynb', entries: { 'out/ipynbMain.node.js': 'src/ipynbMain.node.ts' } },

  // Tooling & Debugging
  { dir: 'npm', entries: { 'out/npmMain.js': 'src/npmMain.ts' } },
  { dir: 'debug-auto-launch', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'debug-server-ready', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'media-preview', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'merge-conflict', entries: { 'out/mergeConflictMain.js': 'src/mergeConflictMain.ts' } },
  { dir: 'references-view', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'search-result', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'simple-browser', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'terminal-suggest', entries: { 'out/terminalSuggestMain.js': 'src/terminalSuggestMain.ts' } },
  { dir: 'tunnel-forwarding', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'vscode-test-resolver', entries: { 'out/extension.js': 'src/extension.ts' } },
  { dir: 'grunt', entries: { 'out/main.js': 'src/main.ts' } },
  { dir: 'gulp', entries: { 'out/main.js': 'src/main.ts' } },
  { dir: 'jake', entries: { 'out/main.js': 'src/main.ts' } },
];

async function buildAllExtensions() {
  console.log('⚡ Compiling built-in extensions with esbuild...');
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  for (const config of extensionConfigs) {
    const extDir = path.join(extensionsRoot, config.dir);
    if (!fs.existsSync(extDir)) continue;

    for (const [outRelative, srcRelative] of Object.entries(config.entries)) {
      const srcPath = path.join(extDir, srcRelative);
      const outPath = path.join(extDir, outRelative);

      if (!fs.existsSync(srcPath)) {
        continue;
      }

      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      try {
        await esbuild.build({
          entryPoints: [srcPath],
          outfile: outPath,
          bundle: true,
          platform: 'node',
          format: 'cjs',
          packages: 'external',
          external: ['../node_modules/find-yarn-workspace-root'],
          target: ['node20'],
          sourcemap: true,
          logLevel: 'warning'
        });
        successCount++;
      } catch (err) {
        console.warn(`  ⚠️ Failed to compile ${config.dir}/${srcRelative}:`, err.message);
        failCount++;
      }
    }
  }

  console.log(`✅ Compiled ${successCount} built-in extension modules in ${Date.now() - startTime}ms (failed: ${failCount})`);
}

buildAllExtensions();
