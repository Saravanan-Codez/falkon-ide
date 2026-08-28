import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const NODE_VERSION = 'v24.13.1';

export async function fetchPortableNode(targetDir) {
  const dest = targetDir || path.join(rootDir, 'resources', 'node');
  fs.mkdirSync(dest, { recursive: true });

  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

  const nodeExePath = isWin
    ? path.join(dest, 'node.exe')
    : path.join(dest, 'bin', 'node');

  if (fs.existsSync(nodeExePath)) {
    console.log(`✅ Portable Node.js runtime already present: ${nodeExePath}`);
    return nodeExePath;
  }

  console.log(`\n📥 Fetching portable Node.js ${NODE_VERSION} (${process.platform}-${arch})...`);

  let archiveName, url;
  if (isWin) {
    archiveName = `node-${NODE_VERSION}-win-${arch}.zip`;
    url = `https://nodejs.org/dist/${NODE_VERSION}/${archiveName}`;
  } else if (isMac) {
    archiveName = `node-${NODE_VERSION}-darwin-${arch}.tar.gz`;
    url = `https://nodejs.org/dist/${NODE_VERSION}/${archiveName}`;
  } else {
    archiveName = `node-${NODE_VERSION}-linux-${arch}.tar.xz`;
    url = `https://nodejs.org/dist/${NODE_VERSION}/${archiveName}`;
  }

  const tempArchive = path.join(dest, archiveName);
  const tempExtract = path.join(dest, '.temp_node');

  if (fs.existsSync(tempExtract)) {
    fs.rmSync(tempExtract, { recursive: true, force: true });
  }
  fs.mkdirSync(tempExtract, { recursive: true });

  try {
    console.log(`   → Downloading from ${url}`);
    execSync(`curl -fsSL "${url}" -o "${tempArchive}"`, { stdio: 'inherit' });

    console.log('   → Extracting Node runtime...');
    if (isWin) {
      execSync(`powershell -Command "Expand-Archive -Path '${tempArchive}' -DestinationPath '${tempExtract}'"`, { stdio: 'inherit' });
    } else if (archiveName.endsWith('.tar.xz')) {
      execSync(`tar -xf "${tempArchive}" -C "${tempExtract}"`, { stdio: 'inherit' });
    } else {
      execSync(`tar -xzf "${tempArchive}" -C "${tempExtract}"`, { stdio: 'inherit' });
    }

    const extractedEntries = fs.readdirSync(tempExtract, { withFileTypes: true });
    const subFolder = extractedEntries.find(e => e.isDirectory());
    const extractedRoot = subFolder ? path.join(tempExtract, subFolder.name) : tempExtract;

    if (isWin) {
      const srcNodeExe = path.join(extractedRoot, 'node.exe');
      if (fs.existsSync(srcNodeExe)) {
        fs.copyFileSync(srcNodeExe, path.join(dest, 'node.exe'));
      }
    } else {
      const srcBinDir = path.join(extractedRoot, 'bin');
      const destBinDir = path.join(dest, 'bin');
      fs.mkdirSync(destBinDir, { recursive: true });

      const srcNode = path.join(srcBinDir, 'node');
      const destNode = path.join(destBinDir, 'node');
      if (fs.existsSync(srcNode)) {
        fs.copyFileSync(srcNode, destNode);
        fs.chmodSync(destNode, 0o755);

        if (process.platform === 'linux') {
          try {
            execSync(`strip --strip-unneeded "${destNode}"`, { stdio: 'ignore' });
          } catch (_) {}
        }
      }
    }

    fs.rmSync(tempArchive, { force: true });
    fs.rmSync(tempExtract, { recursive: true, force: true });

    if (fs.existsSync(nodeExePath)) {
      console.log(`✅ Portable Node runtime ready: ${nodeExePath}`);
      return nodeExePath;
    }
  } catch (err) {
    console.error('❌ Failed to fetch portable Node runtime:', err.message);
  }

  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchPortableNode();
}
