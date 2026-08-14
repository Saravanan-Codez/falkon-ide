import fs from 'fs';
import path from 'path';

function applyLogo() {
  console.log('🦅 Applying FalkonIDE logo across all required project locations...');

  const fullSvgPath = path.resolve('FalkonIDE.svg');
  const uiSvgPath = path.resolve('FalkonIDE-ui.svg');

  if (!fs.existsSync(fullSvgPath) || !fs.existsSync(uiSvgPath)) {
    console.error('❌ FalkonIDE.svg or FalkonIDE-ui.svg not found!');
    return;
  }

  const fullSvgContent = fs.readFileSync(fullSvgPath, 'utf8');
  const uiSvgContent = fs.readFileSync(uiSvgPath, 'utf8');

  // Small UI icons (code-icon, favicon)
  const smallUiSvgTargets = [
    'src/vs/workbench/browser/media/code-icon.svg',
    'src/vs/sessions/browser/media/vscode-icon.svg',
    'src/vs/sessions/browser/media/sessions-icon.svg',
    'src/vs/sessions/browser/media/sessions-logo-dark.svg',
    'src/vs/sessions/browser/media/sessions-logo-light.svg',
    'extensions/github-authentication/media/code-icon.svg',
    'src/extensions/github-authentication/media/code-icon.svg',
    'dist/favicon.svg',
    'src/favicon.svg',
  ];

  for (const relPath of smallUiSvgTargets) {
    const fullPath = path.resolve(relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, uiSvgContent, 'utf8');
    console.log(`  ✓ Updated UI SVG: ${relPath}`);
  }

  // Large editor welcome watermark logos (letterpress-*.svg) - use full vector FalkonIDE.svg for 100% crisp resolution
  const letterpressTargets = [
    'src/vs/workbench/browser/parts/editor/media/letterpress-dark.svg',
    'src/vs/workbench/browser/parts/editor/media/letterpress-light.svg',
    'src/vs/workbench/browser/parts/editor/media/letterpress-hcDark.svg',
    'src/vs/workbench/browser/parts/editor/media/letterpress-hcLight.svg',
  ];

  for (const relPath of letterpressTargets) {
    const fullPath = path.resolve(relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, fullSvgContent, 'utf8');
    console.log(`  ✓ Updated Vector Letterpress SVG: ${relPath}`);
  }

  // Binary app icon mappings (from src-tauri/icons to resources, extensions & dist)
  const iconMappings = [
    { src: 'src-tauri/icons/icon.ico', dest: 'resources/win32/code.ico' },
    { src: 'src-tauri/icons/icon.png', dest: 'resources/linux/code.png' },
    { src: 'src-tauri/icons/icon.icns', dest: 'resources/darwin/code.icns' },
    { src: 'src-tauri/icons/Square150x150Logo.png', dest: 'resources/win32/code_150x150.png' },
    { src: 'src-tauri/icons/Square71x71Logo.png', dest: 'resources/win32/code_70x70.png' },
    { src: 'src-tauri/icons/icon.png', dest: 'resources/server/code-512.png' },
    { src: 'src-tauri/icons/icon.png', dest: 'resources/server/code-192.png' },
    { src: 'src-tauri/icons/icon.ico', dest: 'resources/server/favicon.ico' },
    { src: 'src-tauri/icons/icon.ico', dest: 'extensions/github-authentication/media/favicon.ico' },
    { src: 'src-tauri/icons/icon.ico', dest: 'extensions/microsoft-authentication/media/favicon.ico' },
    { src: 'src-tauri/icons/icon.ico', dest: 'src/extensions/github-authentication/media/favicon.ico' },
    { src: 'src-tauri/icons/icon.ico', dest: 'src/extensions/microsoft-authentication/media/favicon.ico' },
    { src: 'src-tauri/icons/icon.ico', dest: 'dist/favicon.ico' },
    { src: 'src-tauri/icons/icon.png', dest: 'dist/favicon.png' },
  ];

  for (const { src, dest } of iconMappings) {
    const srcPath = path.resolve(src);
    const destPath = path.resolve(dest);
    if (fs.existsSync(srcPath)) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✓ Updated Icon: ${dest}`);
    } else {
      console.warn(`  ⚠️ Icon source missing: ${src}`);
    }
  }

  console.log('✅ FalkonIDE logo successfully applied everywhere!');
}

applyLogo();
