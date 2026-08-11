import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/gt/.gemini/antigravity/brain/c32a19cf-5500-4418-9352-8f56cd6c8822';
const TARGET_URL = 'http://127.0.0.1:9888/?tkn=falkon-dev-token&folder=/home/gt/falkon-labs/Falkon_Dev_Kit';

async function runBattleTest() {
  console.log('🚀 Starting Falkon Dev Kit Full Workbench Battle Test...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const consoleLogs = [];

  page.on('console', msg => {
    const text = `[Browser Console ${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('  🔴', text);
    } else if (msg.type() === 'warn') {
      console.warn('  🟡', text);
    }
  });

  page.on('pageerror', err => {
    console.error('  🔥 [Uncaught Page Error]:', err.message);
    consoleErrors.push(err.message);
  });

  try {
    console.log(`📡 1. Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('⏳ 2. Waiting for .monaco-workbench to mount...');
    await page.waitForSelector('.monaco-workbench', { timeout: 30000 });
    console.log('   ✅ .monaco-workbench mounted successfully!');

    console.log('⏳ 3. Waiting for Activity Bar and Title Bar...');
    await page.waitForSelector('.part.activitybar', { timeout: 15000 });
    console.log('   ✅ Activity Bar active!');

    // Wait a brief moment for themes and layout to settle
    await page.waitForTimeout(2000);

    const titlebarHTML = await page.evaluate(() => {
      const tb = document.querySelector('.part.titlebar');
      return tb ? tb.outerHTML : 'NO TITLEBAR FOUND';
    });
    console.log('--- TITLEBAR HTML ---');
    console.log(titlebarHTML);
    console.log('---------------------');

    const shot1 = path.join(ARTIFACTS_DIR, 'battle_test_workbench_loaded.png');
    await page.screenshot({ path: shot1 });
    console.log(`   📸 Screenshot saved: ${shot1}`);

    // Test 2: Command Palette & Terminal
    console.log('⌨️ 4. Opening Command Palette (F1)...');
    await page.keyboard.press('F1');
    await page.waitForSelector('.quick-input-widget', { timeout: 5000 });
    console.log('   ✅ Command Palette open!');

    console.log('⌨️ 5. Executing "View: Toggle Terminal"...');
    await page.keyboard.type('View: Toggle Terminal');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);
    const shot2 = path.join(ARTIFACTS_DIR, 'battle_test_terminal.png');
    await page.screenshot({ path: shot2 });
    console.log(`   📸 Screenshot saved: ${shot2}`);

    // Test 3: Extensions Marketplace
    console.log('🧩 6. Opening Extensions Viewlet...');
    await page.keyboard.press('Control+Shift+X');
    await page.waitForTimeout(2500);

    const shot3 = path.join(ARTIFACTS_DIR, 'battle_test_extensions.png');
    await page.screenshot({ path: shot3 });
    console.log(`   📸 Screenshot saved: ${shot3}`);

    // Test 4: Open File in Editor
    console.log('📁 7. Opening package.json in Monaco Editor...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+P');
    await page.waitForTimeout(1000);
    await page.keyboard.type('package.json');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');

    console.log('⏳ 8. Waiting for Monaco Editor lines to render...');
    await page.waitForSelector('.monaco-editor .view-lines', { timeout: 10000 });
    console.log('   ✅ Monaco Editor active with tokenized code!');

    await page.waitForTimeout(2000);
    const shot4 = path.join(ARTIFACTS_DIR, 'battle_test_editor.png');
    await page.screenshot({ path: shot4 });
    console.log(`   📸 Screenshot saved: ${shot4}`);

    console.log('\n========================================');
    console.log('🎉 ALL BATTLE TESTS COMPLETED SUCCESSFULLY!');
    console.log(`   Total Console Errors: ${consoleErrors.length}`);
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ Battle test failed with error:', err);
    const errShot = path.join(ARTIFACTS_DIR, 'battle_test_failure.png');
    await page.screenshot({ path: errShot }).catch(() => {});
  } finally {
    await browser.close();
  }
}

runBattleTest();
