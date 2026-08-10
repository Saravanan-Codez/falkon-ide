import * as esbuild from 'esbuild';

async function bundleTauriVSCode() {
  console.log('Bundling VS Code Workbench for Tauri...');
  const startTime = Date.now();

  try {
    const result = await esbuild.build({
      entryPoints: ['src/vs/workbench/browser/web.factory.ts'],
      bundle: true,
      outfile: 'src/dist/workbench.js',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
      external: [
        'electron',
        'vscode-sqlite3',
        'vscode-regexpp',
        'crypto',
        'fs',
        'path',
        'os',
        'child_process'
      ],
      define: {
        'process.env.NODE_ENV': '"development"',
        'global': 'window'
      },
      logLevel: 'warning'
    });

    console.log(`Successfully bundled VS Code Workbench to src/dist/workbench.js in ${Date.now() - startTime}ms!`);
  } catch (err) {
    console.error('ESBuild bundling error:', err);
  }
}

bundleTauriVSCode();
