import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = new Set([
  'test',
  'node_modules',
  'out',
  'dist',
  'electron-browser',
  'electron-main',
  'electron-sandbox',
  'electron-utility',
  'electron-sandbox-preload',
]);

function findTsFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (!IGNORED_DIRS.has(item.name)) {
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
  console.log('⚡ Transpiling VS Code browser & workbench modules...');
  const files = findTsFiles('src/vs');

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
      logLevel: 'error'
    });

    console.log(`✅ Transpiled ${files.length} modules in ${Date.now() - startTime}ms`);
  } catch (err) {
    console.error('❌ Transpilation error:', err);
  }
}

buildVSCode();
