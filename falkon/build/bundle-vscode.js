import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

// Files to exclude from CSS collection (previously generated output files that
// cause a recursive bundling loop and blow up the CSS size to 70+ MB)
const EXCLUDED_CSS_FILES = new Set([
  path.resolve('src/vs/code/browser/workbench/workbench.css'),
  path.resolve('src/dist/workbench.css'),
  path.resolve('src/dist/all-components.css'),
]);

function findFiles(dir, ext, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'test' && item.name !== 'node_modules' && item.name !== 'out' && item.name !== 'dist') {
        findFiles(fullPath, ext, fileList);
      }
    } else if (item.isFile() && item.name.endsWith(ext)) {
      // Skip any previously bundled output files to prevent recursive inclusion
      if (!EXCLUDED_CSS_FILES.has(path.resolve(fullPath))) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

async function bundleTauriVSCode() {
  console.log('📦 Bundling VS Code Web Workbench for Tauri...');
  const startTime = Date.now();

  // Step 0: Apply Falkon patches to upstream VS Code source files.
  // This runs BEFORE compilation so changes always survive upstream git pulls.
  try {
    const { applyPatches } = await import('../patcher/patch-upstream.js');
    applyPatches();
  } catch (e) {
    console.error('❌ patch-upstream.js failed:', e);
    process.exit(1);
  }

  // Apply FalkonIDE.svg logo across all project locations
  try {
    await import('../branding/apply-logo.mjs');
  } catch (e) {
    console.warn('⚠️ Could not run apply-falkon-logo:', e);
  }

  // Build all 38 built-in extension modules (Git, TypeScript, Markdown, Copilot, etc.)
  try {
    await import('../../build/build-all-extensions.mjs');
  } catch (e) {
    console.warn('⚠️ Could not run build-all-extensions:', e);
  }

  if (!fs.existsSync('src/dist')) {
    fs.mkdirSync('src/dist', { recursive: true });
  }

  // Remove stale output CSS files before bundling to prevent recursive inclusion
  const staleFiles = [
    'src/dist/workbench.css',
    'src/dist/all-components.css',
    'src/vs/code/browser/workbench/workbench.css',
  ];
  for (const f of staleFiles) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  try {
    // Prefer .ts over .js when importing
    const preferTsPlugin = {
      name: 'prefer-ts',
      setup(build) {
        build.onResolve({ filter: /\.js$/ }, args => {
          if (args.path.startsWith('.')) {
            const dir = args.resolveDir;
            const tsPath = path.resolve(dir, args.path.replace(/\.js$/, '.ts'));
            if (fs.existsSync(tsPath)) {
              return { path: tsPath };
            }
          }
        });
      }
    };

    // 1. Bundle JavaScript Workbench
    console.log('   - Bundling workbench.ts (browser launcher)...');
    await esbuild.build({
      entryPoints: ['src/vs/code/browser/workbench/workbench.ts'],
      bundle: true,
      outfile: 'src/dist/workbench.js',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
      plugins: [preferTsPlugin],
      minify: true,
      ignoreAnnotations: true,
      banner: {
        js: `// VS Code Web Workbench bundle (Tauri edition)\n`,
      },
      loader: {
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.ttf': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
        '.gif': 'dataurl',
        '.jpg': 'dataurl',
        '.jpeg': 'dataurl',
      },
      external: [
        'electron',
        'vscode-sqlite3',
        'crypto',
        'fs',
        'path',
        'os',
        'child_process',
        'net',
        'http',
        'https',
        'stream',
        'zlib',
        'util',
        'assert',
        '@microsoft/1ds-core-js',
        '@microsoft/1ds-post-js',
      ],
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'window',
        'process.platform': '"browser"',
        'process.type': '"renderer"',
      },
      logLevel: 'warning',
      metafile: false,
    });

    // 2. Collect ALL component CSS files in src/vs
    console.log('   - Collecting all 400+ VS Code component stylesheets...');
    const allCssFiles = findFiles('src/vs', '.css');
    console.log(`     Found ${allCssFiles.length} CSS stylesheets to bundle.`);

    // Generate combined CSS with relative imports
    const combinedCss = allCssFiles
      .map(file => `@import "${path.resolve(file).replace(/\\/g, '/')}";`)
      .join('\n');
    fs.writeFileSync('src/dist/all-components.css', combinedCss);

    // Bundle combined CSS with dataurl fonts and icons
    await esbuild.build({
      entryPoints: ['src/dist/all-components.css'],
      bundle: true,
      outfile: 'src/dist/workbench.css',
      minify: true,
      loader: {
        '.ttf': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.gif': 'dataurl',
      },
      logLevel: 'warning',
    });

    // Clean up temporary entrypoint
    if (fs.existsSync('src/dist/all-components.css')) {
      fs.unlinkSync('src/dist/all-components.css');
    }

    // Bundle Node.js Extension Host Server sidecar script
    const extHostSource = 'falkon/core/ext-host-server.js';
    if (fs.existsSync(extHostSource)) {
      console.log('   - Bundling Node.js Extension Host sidecar script...');
      await esbuild.build({
        entryPoints: [extHostSource],
        bundle: true,
        outfile: 'dist/ext-host-server.js',
        format: 'cjs',
        target: 'node18',
        platform: 'node',
        minify: false,
        logLevel: 'warning',
      });
      if (!fs.existsSync('src/dist')) fs.mkdirSync('src/dist', { recursive: true });
      fs.copyFileSync('dist/ext-host-server.js', 'src/dist/ext-host-server.js');
    }

    // Also mirror to out/vs/code/browser/workbench/ for VS Code server
    fs.mkdirSync('out/vs/code/browser/workbench', { recursive: true });
    fs.copyFileSync('src/dist/workbench.js', 'out/vs/code/browser/workbench/workbench.js');
    fs.copyFileSync('src/dist/workbench.css', 'out/vs/code/browser/workbench/workbench.css');
    if (!fs.existsSync('out/nls.messages.js')) {
      fs.writeFileSync('out/nls.messages.js', 'export default {};\n');
    }
    if (!fs.existsSync('out/nls.messages.json')) {
      fs.writeFileSync('out/nls.messages.json', '{}\n');
    }
    if (!fs.existsSync('src/nls.messages.json')) {
      fs.writeFileSync('src/nls.messages.json', '{}\n');
    }

function copyExtensionDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const items = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const item of items) {
    if (item.name === 'node_modules' || item.name === 'src' || item.name === 'test' || item.name === '.git') continue;
    const srcPath = path.join(srcDir, item.name);
    const destPath = path.join(destDir, item.name);
    if (item.isDirectory()) {
      copyExtensionDir(srcPath, destPath);
    } else if (item.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function processBuiltinExtensions(extensionsSrcDir, extensionsDestDir) {
  console.log('   - Processing and copying built-in extension assets...');
  const bundledExtensions = [];
  if (!fs.existsSync(extensionsSrcDir)) return bundledExtensions;

  fs.mkdirSync(extensionsDestDir, { recursive: true });
  const entries = fs.readdirSync(extensionsSrcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const extSrcPath = path.join(extensionsSrcDir, entry.name);
    const pkgJsonPath = path.join(extSrcPath, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    try {
      const packageJSON = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (!packageJSON.name || !packageJSON.publisher) continue;

      // Ensure extensionKind supports web execution for built-in extensions (Git, Language Features, Themes)
      packageJSON.extensionKind = ['ui', 'workspace', 'web'];
      const hasValidBrowser = packageJSON.browser && fs.existsSync(path.join(extSrcPath, packageJSON.browser));
      const hasValidDistBrowser = fs.existsSync(path.join(extSrcPath, 'dist/browser/extension.js'));
      if (hasValidBrowser) {
        // Keep valid browser bundle
      } else if (hasValidDistBrowser) {
        packageJSON.browser = './dist/browser/extension.js';
      } else {
        delete packageJSON.browser;
        delete packageJSON.main;
      }

      let packageNLS;
      const nlsPath = path.join(extSrcPath, 'package.nls.json');
      if (fs.existsSync(nlsPath)) {
        try {
          packageNLS = JSON.parse(fs.readFileSync(nlsPath, 'utf8'));
        } catch (_) {}
      }

      // Copy extension assets to dist/extensions/<name>
      const extDestPath = path.join(extensionsDestDir, entry.name);
      copyExtensionDir(extSrcPath, extDestPath);

      bundledExtensions.push({
        extensionPath: entry.name,
        packageJSON,
        ...(packageNLS ? { packageNLS } : {})
      });
    } catch (e) {
      console.warn(`    ⚠️ Failed to process extension ${entry.name}:`, e.message);
    }
  }

  console.log(`     Bundled ${bundledExtensions.length} built-in extensions to ${extensionsDestDir}`);
  return bundledExtensions;
}

    // Populate dist/ directory for Tauri frontendDist
    fs.mkdirSync('dist/dist', { recursive: true });
    fs.mkdirSync('dist/js', { recursive: true });
    fs.mkdirSync('dist/out/vs/code/browser/workbench', { recursive: true });
    fs.copyFileSync('src/dist/workbench.js', 'dist/dist/workbench.js');
    fs.copyFileSync('src/dist/workbench.css', 'dist/dist/workbench.css');
    fs.copyFileSync('src/dist/workbench.js', 'dist/out/vs/code/browser/workbench/workbench.js');
    if (fs.existsSync('src/vs')) {
      fs.cpSync('src/vs', 'dist/vs', { recursive: true });
    }
    const tauriShimSource = 'falkon/core/tauri-shim.js';
    if (fs.existsSync(tauriShimSource)) {
      fs.mkdirSync('js', { recursive: true });
      fs.mkdirSync('out/js', { recursive: true });
      fs.copyFileSync(tauriShimSource, 'js/tauri-shim.js');
      fs.copyFileSync(tauriShimSource, 'dist/js/tauri-shim.js');
      fs.copyFileSync(tauriShimSource, 'out/js/tauri-shim.js');
    }
    if (fs.existsSync('src/resources')) {
      fs.cpSync('src/resources', 'dist/resources', { recursive: true });
    }

    const codiconSrc = fs.existsSync('src/vs/base/browser/ui/codicons/codicon/codicon.ttf')
      ? 'src/vs/base/browser/ui/codicons/codicon/codicon.ttf'
      : (fs.existsSync('node_modules/@vscode/codicons/dist/codicon.ttf') ? 'node_modules/@vscode/codicons/dist/codicon.ttf' : null);

    if (codiconSrc) {
      const targets = [
        'dist/codicon.ttf',
        'dist/dist/codicon.ttf',
        'dist/vs/base/browser/ui/codicons/codicon/codicon.ttf',
        'dist/dist/vs/base/browser/ui/codicons/codicon/codicon.ttf'
      ];
      for (const target of targets) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(codiconSrc, target);
      }
    }

    // Process and mirror all 90+ built-in extension packages & assets
    const bundledExtensions = processBuiltinExtensions('extensions', 'dist/extensions');
    const bundledExtSettings = JSON.stringify(bundledExtensions).replace(/"/g, '&quot;');

    // Generate dist/index.html entrypoint for Tauri (standalone web workbench with built-in extensions)
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
		<title>Falkon IDE</title>
		<link rel="icon" type="image/svg+xml" href="./favicon.svg">
		<link rel="alternate icon" href="./favicon.ico">
		<meta id="vscode-workbench-web-configuration" data-settings="{&quot;productConfiguration&quot;:{&quot;nameShort&quot;:&quot;Falkon IDE&quot;,&quot;nameLong&quot;:&quot;Falkon IDE&quot;,&quot;applicationName&quot;:&quot;falkon-ide&quot;,&quot;dataFolderName&quot;:&quot;.falkon-ide&quot;,&quot;licenseName&quot;:&quot;MIT&quot;,&quot;version&quot;:&quot;1.134.0&quot;,&quot;extensionsGallery&quot;:{&quot;serviceUrl&quot;:&quot;https://marketplace.visualstudio.com/_apis/public/gallery&quot;,&quot;itemUrl&quot;:&quot;https://marketplace.visualstudio.com/items&quot;,&quot;resourceUrlTemplate&quot;:&quot;https://marketplace.visualstudio.com/_apis/public/gallery/publishers/{publisher}/vsextensions/{name}/{version}/vspackage&quot;}}}">
		<meta id="vscode-workbench-auth-session" data-settings="">
		<meta id="vscode-workbench-builtin-extensions" data-settings="${bundledExtSettings}">
		<link rel="stylesheet" href="./dist/workbench.css">
		<style>
			*, *:before, *:after {
				box-sizing: border-box;
			}
			html, body {
				width: 100vw;
				height: 100vh;
				margin: 0;
				padding: 0;
				overflow: hidden;
				background-color: #1e1e1e;
				color: #cccccc;
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
			}
			#workbench-container {
				width: 100vw;
				height: 100vh;
				display: flex;
				flex-direction: column;
				overflow: hidden;
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
			}
		</style>
	</head>
	<body class="vs-dark" aria-label="">
		<div id="workbench-container"></div>
		<script>
			const _base = new URL('.', window.location.href).href;
			globalThis._VSCODE_FILE_ROOT = _base;
			self._VSCODE_FILE_ROOT = _base;
		</script>
		<!-- tauri-shim.js must run synchronously BEFORE the workbench module loads -->
		<script src="./js/tauri-shim.js"></script>
		<script type="module" src="./dist/workbench.js"></script>
	</body>
</html>
`;



    fs.writeFileSync('dist/index.html', indexHtmlContent);
    fs.writeFileSync('src/index.html', indexHtmlContent);

    // Mirror necessary runtime assets and fallback stubs for cross-platform VS Code Workbench
    const keyboardLayoutsDir = 'out/vs/workbench/services/keybinding/browser/keyboardLayouts';
    fs.mkdirSync(keyboardLayoutsDir, { recursive: true });
    for (const plat of ['win', 'linux', 'darwin']) {
      const file = `${keyboardLayoutsDir}/layout.contribution.${plat}.js`;
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '// Keyboard layout contribution stub for Tauri VS Code\nexport const layout = {};\n');
      }
    }

    const workerExtDir = 'out/vs/workbench/services/extensions/worker';
    fs.mkdirSync(workerExtDir, { recursive: true });
    if (!fs.existsSync(`${workerExtDir}/webWorkerExtensionHostIframe.html`)) {
      fs.writeFileSync(
        `${workerExtDir}/webWorkerExtensionHostIframe.html`,
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>// Extension Host Worker Iframe</script></body></html>\n'
      );
    }

    const editorWorkerDir = 'out/vs/editor/common/services';
    fs.mkdirSync(editorWorkerDir, { recursive: true });
    if (!fs.existsSync(`${editorWorkerDir}/editorWebWorkerMain.js`)) {
      fs.writeFileSync(
        `${editorWorkerDir}/editorWebWorkerMain.js`,
        '// Editor Web Worker main entry stub\nself.onmessage = function() {};\n'
      );
    }

    // Generate out/server-main.js entrypoint for scripts/code-server.js
    const serverMainContent = `const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.VSCODE_SERVER_PORT || 9888;
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(__dirname, '..', 'dist', reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Web UI available at http://127.0.0.1:' + PORT + '/?tkn=falkon-dev-token');
});
`;
    fs.mkdirSync('out', { recursive: true });
    fs.writeFileSync('out/server-main.js', serverMainContent);

    // VSDA stubs to prevent require('vsda') MODULE_NOT_FOUND errors in Node.js server
    const vsdaCjsDir = 'node_modules/vsda';
    fs.mkdirSync(vsdaCjsDir, { recursive: true });
    fs.writeFileSync(`${vsdaCjsDir}/package.json`, JSON.stringify({ name: "vsda", version: "1.0.0", main: "index.js" }, null, 2));
    fs.writeFileSync(`${vsdaCjsDir}/index.js`, `
class Signer { sign() { return ""; } }
class Validator { validate() { return true; } }
module.exports = {
  signer: Signer,
  validator: Validator,
  signer_create: () => new Signer(),
  validator_create: () => new Validator()
};
`);

    const vsdaDir = 'node_modules/vsda/rust/web';
    fs.mkdirSync(vsdaDir, { recursive: true });
    if (!fs.existsSync(`${vsdaDir}/vsda.js`)) {
      fs.writeFileSync(`${vsdaDir}/vsda.js`, 'export default function init() { return Promise.resolve(); }\nexport class signer { sign() { return ""; } }\nexport class validator { validate() { return true; } }\n');
    }
    if (!fs.existsSync(`${vsdaDir}/vsda_bg.wasm`)) {
      fs.writeFileSync(`${vsdaDir}/vsda_bg.wasm`, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
    }

    const cssStats = fs.statSync('src/dist/workbench.css');
    const jsStats = fs.statSync('src/dist/workbench.js');
    const elapsed = Date.now() - startTime;
    console.log(`✅ VS Code Workbench bundled successfully in ${elapsed}ms!`);
    console.log(`   JS  → src/dist/workbench.js (${(jsStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`   CSS → src/dist/workbench.css (${(cssStats.size / 1024).toFixed(2)} KB)`);
  } catch (err) {
    console.error('❌ ESBuild error:', err.message);
    process.exit(1);
  }
}

bundleTauriVSCode();
