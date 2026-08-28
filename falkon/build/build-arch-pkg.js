import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

import { fetchPortableNode } from './fetch-node-runtime.js';

export async function buildArchPackage(options = {}) {
  const isStandalone = !!options.standalone;
  const pkgname = isStandalone ? 'falkon-ide-standalone' : 'falkon-ide';
  console.log(`\n📦 Building Arch Linux Package (.pkg.tar.zst) [${isStandalone ? 'STANDALONE' : 'LITE'}]...`);

  const pkgJsonPath = path.join(rootDir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const version = pkgJson.version || '1.136.0';
  const pkgrel = '1';
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';

  const tauriTargetDir = path.join(rootDir, 'src-tauri', 'target', 'release');
  const possibleBinaries = [
    path.join(tauriTargetDir, 'falkon_ide'),
    path.join(tauriTargetDir, 'falkon-ide'),
  ];

  let binaryPath = possibleBinaries.find(p => fs.existsSync(p));
  if (!binaryPath) {
    console.log('⚡ Release binary not found, building with cargo build --release...');
    try {
      execSync('cargo build --release --manifest-path src-tauri/Cargo.toml', {
        cwd: rootDir,
        stdio: 'inherit'
      });
      binaryPath = possibleBinaries.find(p => fs.existsSync(p));
    } catch (err) {
      console.error('❌ Failed to compile release binary for Arch package:', err.message);
      return null;
    }
  }

  if (!binaryPath || !fs.existsSync(binaryPath)) {
    console.error('❌ Error: Could not locate compiled release binary in', tauriTargetDir);
    return null;
  }

  const outBundleDir = path.join(tauriTargetDir, 'bundle', 'pacman');
  fs.mkdirSync(outBundleDir, { recursive: true });

  const tempStageDir = path.join(tauriTargetDir, 'bundle', '.arch-staging');
  if (fs.existsSync(tempStageDir)) {
    fs.rmSync(tempStageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempStageDir, { recursive: true });

  // 1. Create directory layout
  const binDir = path.join(tempStageDir, 'usr', 'bin');
  const appDir = path.join(tempStageDir, 'usr', 'share', 'applications');
  const iconBaseDir = path.join(tempStageDir, 'usr', 'share', 'icons', 'hicolor');

  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(appDir, { recursive: true });

  // Copy binary and strip debug symbols if strip is available
  const targetBin = path.join(binDir, 'falkon-ide');
  fs.copyFileSync(binaryPath, targetBin);
  fs.chmodSync(targetBin, 0o755);

  try {
    execSync(`strip --strip-unneeded "${targetBin}"`, { stdio: 'ignore' });
  } catch (_) {}

  // Create .desktop entry
  const desktopContent = `[Desktop Entry]
Name=Falkon IDE
Comment=Falkon IDE - Fast, lightweight desktop IDE powered by VS Code Web and Tauri
Exec=falkon-ide %F
Icon=falkon-ide
Type=Application
StartupNotify=true
StartupWMClass=falkon-ide
Categories=Development;IDE;TextEditor;
MimeType=text/plain;inode/directory;
`;
  fs.writeFileSync(path.join(appDir, 'falkon-ide.desktop'), desktopContent);
  fs.chmodSync(path.join(appDir, 'falkon-ide.desktop'), 0o644);

  // Copy icons
  const iconSources = [
    { src: path.join(rootDir, 'src-tauri', 'icons', '32x32.png'), size: '32x32' },
    { src: path.join(rootDir, 'src-tauri', 'icons', '64x64.png'), size: '64x64' },
    { src: path.join(rootDir, 'src-tauri', 'icons', '128x128.png'), size: '128x128' },
    { src: path.join(rootDir, 'src-tauri', 'icons', '128x128@2x.png'), size: '256x256' },
    { src: path.join(rootDir, 'resources', 'linux', 'code.png'), size: '512x512' },
  ];

  for (const item of iconSources) {
    if (fs.existsSync(item.src)) {
      const targetIconDir = path.join(iconBaseDir, item.size, 'apps');
      fs.mkdirSync(targetIconDir, { recursive: true });
      const targetIconFile = path.join(targetIconDir, 'falkon-ide.png');
      fs.copyFileSync(item.src, targetIconFile);
      fs.chmodSync(targetIconFile, 0o644);
    }
  }

  // If standalone, embed portable Node.js runtime into /usr/lib/falkon-ide/bin/node
  if (isStandalone) {
    const nodeBin = await fetchPortableNode();
    if (nodeBin && fs.existsSync(nodeBin)) {
      const libNodeDir = path.join(tempStageDir, 'usr', 'lib', 'falkon-ide', 'bin');
      fs.mkdirSync(libNodeDir, { recursive: true });
      const targetNode = path.join(libNodeDir, 'node');
      fs.copyFileSync(nodeBin, targetNode);
      fs.chmodSync(targetNode, 0o755);
      console.log('   ✓ Embedded portable Node.js runtime into /usr/lib/falkon-ide/bin/node');
    }
  }

  // Calculate total installed size
  let totalSizeBytes = 0;
  function computeSize(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) {
        computeSize(full);
      } else if (f.isFile()) {
        totalSizeBytes += fs.statSync(full).size;
      }
    }
  }
  computeSize(path.join(tempStageDir, 'usr'));

  const buildDateEpoch = Math.floor(Date.now() / 1000);

  // Create .PKGINFO
  const pkgInfoContent = `# Generated by Falkon Arch Packager
pkgname = ${pkgname}
pkgbase = ${pkgname}
pkgver = ${version}-${pkgrel}
pkgdesc = Falkon IDE - Next-Generation Desktop IDE powered by VS Code and Tauri
url = https://github.com/falkon-labs/falkon-ide
builddate = ${buildDateEpoch}
packager = Falkon Labs <contact@falkon.dev>
size = ${totalSizeBytes}
arch = ${arch}
license = MIT
depend = webkit2gtk-4.1
depend = gtk3
depend = libsoup3
depend = openssl
depend = git
`;
  fs.writeFileSync(path.join(tempStageDir, '.PKGINFO'), pkgInfoContent);
  fs.chmodSync(path.join(tempStageDir, '.PKGINFO'), 0o644);

  // Create .BUILDINFO
  const buildInfoContent = `format = 2
pkgname = ${pkgname}
pkgver = ${version}-${pkgrel}
pkgarch = ${arch}
pkgbuild_sha256sum = none
packager = Falkon Labs <contact@falkon.dev>
builddate = ${buildDateEpoch}
builddir = /tmp
pkgtypes = pkg
`;
  fs.writeFileSync(path.join(tempStageDir, '.BUILDINFO'), buildInfoContent);
  fs.chmodSync(path.join(tempStageDir, '.BUILDINFO'), 0o644);

  // Generate .MTREE if bsdtar is available
  try {
    spawnSync('bsdtar', [
      '-czf',
      '.MTREE',
      '--format=mtree',
      '--options=!all,use-set,type,uid,gid,mode,time,size,md5,sha256,link',
      '.PKGINFO',
      '.BUILDINFO',
      'usr'
    ], { cwd: tempStageDir, stdio: 'ignore' });
  } catch (_) {}

  // 2. Archive & Compress with tar + zstd
  const pkgFileName = `${pkgname}-${version}-${pkgrel}-${arch}.pkg.tar.zst`;
  const finalPkgPath = path.join(outBundleDir, pkgFileName);

  try {
    const hasMtree = fs.existsSync(path.join(tempStageDir, '.MTREE'));
    const archiveFiles = hasMtree
      ? '.PKGINFO .BUILDINFO .MTREE usr'
      : '.PKGINFO .BUILDINFO usr';

    execSync(`tar --owner=0 --group=0 --numeric-owner -cf - ${archiveFiles} | zstd -c -T0 -19 > "${finalPkgPath}"`, {
      cwd: tempStageDir,
      shell: '/bin/bash',
      stdio: 'inherit'
    });

    if (fs.existsSync(finalPkgPath)) {
      const stats = fs.statSync(finalPkgPath);
      const mb = (stats.size / (1024 * 1024)).toFixed(2);

      // Generate SHA256 checksum
      const fileBuffer = fs.readFileSync(finalPkgPath);
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      fs.writeFileSync(`${finalPkgPath}.sha256`, `${sha256}  ${pkgFileName}\n`);

      console.log(`✅ Arch package created successfully:`);
      console.log(`   → ${finalPkgPath} (${mb} MB)`);
      console.log(`   → SHA-256: ${sha256}`);
      
      // Cleanup staging
      fs.rmSync(tempStageDir, { recursive: true, force: true });
      return finalPkgPath;
    }
  } catch (err) {
    console.error('❌ Failed to create .pkg.tar.zst package:', err);
  }

  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isStandalone = process.argv.includes('--standalone') || process.argv.includes('-s');
  buildArchPackage({ standalone: isStandalone });
}
