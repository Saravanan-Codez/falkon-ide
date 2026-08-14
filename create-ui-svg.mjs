import fs from 'fs';
import path from 'path';

function createUiSvg() {
  const iconPath = path.resolve('src-tauri/icons/128x128.png');
  if (!fs.existsSync(iconPath)) {
    console.error('src-tauri/icons/128x128.png not found');
    return;
  }

  const buf = fs.readFileSync(iconPath);
  const b64 = buf.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><image width="128" height="128" href="data:image/png;base64,${b64}"/></svg>\n`;

  fs.writeFileSync('FalkonIDE-ui.svg', svg, 'utf8');
  console.log('✅ Created FalkonIDE-ui.svg:', svg.length, 'bytes');
}

createUiSvg();
