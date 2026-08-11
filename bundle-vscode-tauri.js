import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

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
      fileList.push(fullPath);
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
      .map(file => `@import "${path.resolve(file)}";`)
      .join('\n');
    fs.writeFileSync('src/dist/all-components.css', combinedCss);

    // Bundle combined CSS with dataurl fonts and icons
    await esbuild.build({
      entryPoints: ['src/dist/all-components.css'],
      bundle: true,
      outfile: 'src/dist/workbench.css',
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
