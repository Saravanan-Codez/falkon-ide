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

    // Populate minimal dist/ directory for Tauri frontendDist
    fs.mkdirSync('dist/dist', { recursive: true });
    fs.mkdirSync('dist/js', { recursive: true });
    fs.mkdirSync('dist/out/vs/code/browser/workbench', { recursive: true });
    fs.copyFileSync('src/dist/workbench.js', 'dist/dist/workbench.js');
    fs.copyFileSync('src/dist/workbench.css', 'dist/dist/workbench.css');
    fs.copyFileSync('src/dist/workbench.js', 'dist/out/vs/code/browser/workbench/workbench.js');
    fs.copyFileSync('src/dist/workbench.css', 'dist/out/vs/code/browser/workbench/workbench.css');
    if (fs.existsSync('src/js/tauri-shim.js')) {
      fs.copyFileSync('src/js/tauri-shim.js', 'dist/js/tauri-shim.js');
    }
    if (fs.existsSync('src/resources')) {
      fs.cpSync('src/resources', 'dist/resources', { recursive: true });
    }

    // Generate dist/index.html entrypoint for Tauri
    const indexHtmlContent = `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta name="mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-title" content="Falkon IDE">
		<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
		<meta id="vscode-workbench-web-configuration" data-settings="{&quot;remoteAuthority&quot;:&quot;127.0.0.1:9888&quot;,&quot;callbackRoute&quot;:&quot;/callback&quot;,&quot;productConfiguration&quot;:{&quot;nameShort&quot;:&quot;Falkon IDE&quot;,&quot;nameLong&quot;:&quot;Falkon IDE&quot;,&quot;applicationName&quot;:&quot;falkon-ide&quot;}}">
		<meta id="vscode-workbench-auth-session" data-settings="">
		<link rel="stylesheet" href="./dist/workbench.css">
		<style>
			html, body {
				width: 100%;
				height: 100%;
				margin: 0;
				padding: 0;
				overflow: hidden;
				background-color: #181818 !important;
				color: #cccccc;
			}
		</style>
	</head>
	<body class="vs-dark" aria-label="">
	</body>
	<script>
		const baseUrl = new URL('.', window.location.origin).toString();
		globalThis._VSCODE_FILE_ROOT = baseUrl + 'out/';
	</script>
	<script type="module" src="./js/tauri-shim.js"></script>
	<script type="module" src="./dist/workbench.js"></script>
</html>
`;
    fs.writeFileSync('dist/index.html', indexHtmlContent);

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
