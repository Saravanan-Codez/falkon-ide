import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

function findTsFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'test' && item.name !== 'node_modules' && item.name !== 'out' && item.name !== 'dist') {
        findTsFiles(fullPath, fileList);
      }
    } else if (item.isFile()) {
      if (item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

async function buildVSCode() {
  console.log('Scanning TypeScript source files in src/vs...');
  const files = findTsFiles('src/vs');
  console.log(`Found ${files.length} TypeScript files to transpile.`);

  const startTime = Date.now();
  try {
    await esbuild.build({
      entryPoints: files,
      outdir: 'src',
      outbase: 'src',
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
      logLevel: 'warning'
    });

    console.log(`✅ Successfully transpiled ${files.length} VS Code files to src/ in ${Date.now() - startTime}ms!`);
  } catch (err) {
    console.error('❌ ESBuild transpilation error:', err);
  }
}

buildVSCode();
