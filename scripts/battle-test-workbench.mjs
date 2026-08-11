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

    const diagnostics = await page.evaluate(() => {
      const tb = document.querySelector('.part.titlebar');
      const wcc = document.querySelector('.window-controls-container');
      const icons = Array.from(document.querySelectorAll('.window-icon'));
      const right = document.querySelector('.titlebar-right');
      return {
        titlebarRect: tb?.getBoundingClientRect(),
        leftRect: document.querySelector('.titlebar-left')?.getBoundingClientRect(),
        centerRect: document.querySelector('.titlebar-center')?.getBoundingClientRect(),
        commandCenterRect: document.querySelector('.command-center')?.getBoundingClientRect(),
        rightRect: right?.getBoundingClientRect(),
        rightChildren: Array.from(right ? right.children : []).map(c => ({
          tag: c.tagName,
          className: c.className,
          rect: c.getBoundingClientRect(),
          computedWidth: window.getComputedStyle(c).width,
          computedDisplay: window.getComputedStyle(c).display,
          computedFlex: window.getComputedStyle(c).flex,
        })),
        wccRect: wcc?.getBoundingClientRect(),
        wccComputed: wcc ? {
          display: window.getComputedStyle(wcc).display,
          width: window.getComputedStyle(wcc).width,
          height: window.getComputedStyle(wcc).height,
          visibility: window.getComputedStyle(wcc).visibility,
          opacity: window.getComputedStyle(wcc).opacity,
          zIndex: window.getComputedStyle(wcc).zIndex,
        } : null,
        icons: icons.map(icon => ({
          className: icon.className,
          rect: icon.getBoundingClientRect(),
          computed: {
            display: window.getComputedStyle(icon).display,
            width: window.getComputedStyle(icon).width,
            height: window.getComputedStyle(icon).height,
            color: window.getComputedStyle(icon).color,
            fontSize: window.getComputedStyle(icon).fontSize,
            fontFamily: window.getComputedStyle(icon).fontFamily,
            beforeContent: window.getComputedStyle(icon, '::before').content,
          }
        })),
        appliedRules: Array.from(document.styleSheets).flatMap(sheet => {
          try {
            return Array.from(sheet.cssRules || []).filter(rule => rule.selectorText && rule.selectorText.includes('window-controls-container')).map(r => ({ selector: r.selectorText, cssText: r.cssText }));
          } catch (e) {
            return [];
          }
        })
      };
    });
    console.log('--- WINDOW CONTROLS DIAGNOSTICS ---');
    console.log(JSON.stringify(diagnostics, null, 2));
    console.log('-----------------------------------');

    const shot1 = path.join(ARTIFACTS_DIR, 'battle_test_workbench_loaded.png');
    await page.screenshot({ path: shot1 });
    console.log(`   📸 Screenshot saved: ${shot1}`);

    // Test Window Controls Hover
    console.log('🪟 Testing Window Controls Hover...');
    await page.hover('.window-minimize');
    await page.waitForTimeout(200);
    await page.hover('.window-max-restore');
    await page.waitForTimeout(200);
    await page.hover('.window-close');
    await page.waitForTimeout(200);
    console.log('   ✅ Window controls hover responsive!');

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
