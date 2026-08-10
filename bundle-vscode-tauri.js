import * as esbuild from 'esbuild';

async function bundleTauriVSCode() {
  console.log('Bundling complete VS Code Workbench (web.main + all 100+ services) for Tauri...');
  const startTime = Date.now();

  try {
    const result = await esbuild.build({
      entryPoints: ['src/vs/workbench/workbench.web.main.ts'],
      bundle: true,
      outfile: 'src/dist/workbench.js',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
      loader: {
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.ttf': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl'
      },
      external: [
        'electron',
        'vscode-sqlite3',
        'vscode-regexpp',
        'crypto',
        'fs',
        'path',
        'os',
        'child_process',
        '@microsoft/1ds-core-js',
        '@microsoft/1ds-post-js'
      ],
      define: {
        'process.env.NODE_ENV': '"development"',
        'global': 'window'
      },
      logLevel: 'warning'
    });

    console.log(`Successfully bundled complete VS Code Workbench to src/dist/workbench.js in ${Date.now() - startTime}ms!`);
  } catch (err) {
    console.error('ESBuild bundling error:', err);
  }
}

bundleTauriVSCode();
