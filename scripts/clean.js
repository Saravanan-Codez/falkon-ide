import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const dirsToClean = [
  'dist',
  'out',
  'src/dist',
  '.build',
  '.esbuild-cache',
];

console.log('🧹 Cleaning build caches and artifact directories...');

let cleanedCount = 0;
for (const dir of dirsToClean) {
  const fullPath = path.join(rootDir, dir);
  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  ✓ Removed ${dir}`);
      cleanedCount++;
    } catch (err) {
      console.warn(`  ⚠️ Failed to remove ${dir}:`, err.message);
    }
  }
}

console.log(`✅ Clean complete! Removed ${cleanedCount} build cache directories.`);
