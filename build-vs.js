import * as esbuild from 'esbuild';
import { glob } from 'glob';

async function buildVSCode() {
  console.log('Scanning TypeScript source files in src/vs...');
  const files = await glob('src/vs/**/*.ts', { ignore: ['src/vs/**/*.d.ts', 'src/vs/**/test/**'] });
  console.log(`Found ${files.length} TypeScript files to transpile.`);

  const startTime = Date.now();
  try {
    await esbuild.build({
      entryPoints: files,
      outdir: 'src/out',
      outbase: 'src',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
      logLevel: 'warning'
    });

    console.log(`Successfully transpiled ${files.length} VS Code files to src/out in ${Date.now() - startTime}ms!`);
  } catch (err) {
    console.error('ESBuild transpilation error:', err);
  }
}

buildVSCode();
