import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Integration & Bundle Verification', () => {
  it('dist/index.html should exist and contain valid built-in extensions metadata', () => {
    const indexPath = path.resolve('dist/index.html');
    assert.strictEqual(fs.existsSync(indexPath), true, 'dist/index.html must exist');

    const htmlContent = fs.readFileSync(indexPath, 'utf8');
    assert.match(htmlContent, /<meta id="vscode-workbench-builtin-extensions"/, 'dist/index.html must contain builtin-extensions meta tag');
    assert.match(htmlContent, /<script type="module" src="\.\/js\/tauri-shim\.js"><\/script>/, 'dist/index.html must import tauri-shim.js');
    assert.match(htmlContent, /<script type="module" src="\.\/dist\/workbench\.js"><\/script>/, 'dist/index.html must import workbench.js');

    // Extract data-settings attribute and parse JSON
    const match = htmlContent.match(/id="vscode-workbench-builtin-extensions"\s+data-settings="([^"]+)"/);
    assert.ok(match, 'builtin-extensions data-settings attribute must be present');

    const jsonStr = match[1].replace(/&quot;/g, '"');
    const extensionsMeta = JSON.parse(jsonStr);
    assert.ok(Array.isArray(extensionsMeta), 'builtin-extensions must parse to an array');
    assert.ok(extensionsMeta.length > 50, `Expected 50+ built-in extensions, found ${extensionsMeta.length}`);
  });

  it('dist/workbench.js and dist/workbench.css must exist and be non-empty', () => {
    const jsPath = path.resolve('dist/dist/workbench.js');
    const cssPath = path.resolve('dist/dist/workbench.css');

    assert.strictEqual(fs.existsSync(jsPath), true, 'dist/dist/workbench.js must exist');
    assert.strictEqual(fs.existsSync(cssPath), true, 'dist/dist/workbench.css must exist');

    const jsSize = fs.statSync(jsPath).size;
    const cssSize = fs.statSync(cssPath).size;

    assert.ok(jsSize > 10 * 1024 * 1024, `workbench.js should be > 10MB, found ${jsSize}`);
    assert.ok(cssSize > 1 * 1024 * 1024, `workbench.css should be > 1MB, found ${cssSize}`);
  });

  it('dist/extensions directory must contain built-in extension packages', () => {
    const extDir = path.resolve('dist/extensions');
    assert.strictEqual(fs.existsSync(extDir), true, 'dist/extensions must exist');

    const requiredExts = ['git', 'typescript-language-features', 'markdown-language-features', 'theme-defaults', 'html', 'css', 'json'];
    for (const ext of requiredExts) {
      const p = path.join(extDir, ext, 'package.json');
      assert.strictEqual(fs.existsSync(p), true, `Extension ${ext}/package.json must exist in dist/extensions`);
    }
  });
});
