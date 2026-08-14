import fs from 'fs';
import path from 'path';

function extractPng() {
  const svgPath = path.resolve('FalkonIDE.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('FalkonIDE.svg not found!');
    return;
  }

  const svg = fs.readFileSync(svgPath, 'utf8');
  const match = svg.match(/href="data:image\/png;base64,([^"]+)"/);
  if (match) {
    const buf = Buffer.from(match[1], 'base64');
    fs.writeFileSync('FalkonIDE.png', buf);
    console.log('✅ Extracted FalkonIDE.png:', buf.length, 'bytes');
  } else {
    console.error('❌ Base64 image data not found in SVG');
  }
}

extractPng();
