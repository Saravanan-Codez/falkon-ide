import * as esbuild from 'esbuild';

async function bundleTauriVSCode() {
  console.log('Bundling VS Code Workbench for Tauri (entry: web.factory.ts + web.main side-effects)...');
  const startTime = Date.now();

  try {
    await esbuild.build({
      // web.factory.ts exports create() and all other public API
      // workbench.web.main.ts is a side-effect-only module (registers 100+ services)
      entryPoints: ['src/vs/workbench/browser/web.factory.ts'],
      bundle: true,
      outfile: 'src/dist/workbench.js',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
      // Inject workbench.web.main.ts as a side-effect so all services are registered
      inject: [],
      banner: {
        js: `// VS Code Web Workbench bundle (Tauri edition)\n// Side-effect imports from workbench.web.main.ts are bundled below via inject\n`,
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

    // Also bundle the CSS
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
    console.log(`✅ VS Code Workbench bundled in ${elapsed}ms`);
    console.log(`   JS  → src/dist/workbench.js`);
    console.log(`   CSS → src/dist/workbench.css`);
  } catch (err) {
    console.error('❌ ESBuild error:', err.message);
    process.exit(1);
  }
}

bundleTauriVSCode();
