import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

async function bundleTauriVSCode() {
  console.log('📦 Bundling VS Code Web Workbench for Tauri...');
  const startTime = Date.now();

  // Ensure src/dist directory exists
  if (!fs.existsSync('src/dist')) {
    fs.mkdirSync('src/dist', { recursive: true });
  }

  try {
    // 1. Bundle JavaScript Workbench
    console.log('   - Bundling workbench.web.main.ts (with all contributions & services)...');
    await esbuild.build({
      entryPoints: ['src/vs/workbench/workbench.web.main.ts'],
      bundle: true,
      outfile: 'src/dist/workbench.js',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
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

    // 2. Bundle CSS (Workbench style + Codicons font icons)
    console.log('   - Bundling styles and codicon fonts...');
    await esbuild.build({
      entryPoints: ['src/vs/workbench/browser/media/style.css'],
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

    const elapsed = Date.now() - startTime;
    console.log(`✅ VS Code Workbench bundled successfully in ${elapsed}ms!`);
    console.log(`   JS  → src/dist/workbench.js`);
    console.log(`   CSS → src/dist/workbench.css`);
  } catch (err) {
    console.error('❌ ESBuild error:', err.message);
    process.exit(1);
  }
}

bundleTauriVSCode();
