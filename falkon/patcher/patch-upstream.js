/**
 * patch-upstream.js
 *
 * Applies Falkon IDE–specific patches to upstream VS Code source files.
 * Run automatically by bundle-vscode-tauri.js before bundling.
 *
 * Strategy: ALL Falkon logic that touches Microsoft's src/vs/** files
 * lives here as text patches. The actual source files are NEVER committed
 * with our changes — this script re-applies them on every build, so
 * upstream git pulls are completely safe.
 *
 * Each patch entry:
 *   file    – path relative to repo root (forward slashes)
 *   desc    – human-readable description shown in build output
 *   find    – exact upstream text to search for
 *   replace – Falkon replacement text
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

// ─────────────────────────────────────────────
//  Patch definitions  (upstream → Falkon)
// ─────────────────────────────────────────────

const PATCHES = [

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ 1. platform.ts
  // │    Upstream sets _isWeb = true in the browser branch.
  // │    In Tauri we are a desktop app — flip to _isNative=true, _isWeb=false.
  // └─────────────────────────────────────────────────────────────────────────
  {
    file: 'src/vs/base/common/platform.ts',
    desc: 'Browser branch: set _isNative=true, _isWeb=false in Tauri desktop',
    find:
`// Web environment
else if (typeof navigator === 'object' && !isElectronRenderer) {
\t_userAgent = navigator.userAgent;
\t_isWindows = _userAgent.indexOf('Windows') >= 0;
\t_isMacintosh = _userAgent.indexOf('Macintosh') >= 0;
\t_isIOS = (_userAgent.indexOf('Macintosh') >= 0 || _userAgent.indexOf('iPad') >= 0 || _userAgent.indexOf('iPhone') >= 0) && !!navigator.maxTouchPoints && navigator.maxTouchPoints > 0;
\t_isLinux = _userAgent.indexOf('Linux') >= 0;
\t_isMobile = _userAgent?.indexOf('Mobi') >= 0;
\t_isWeb = true;`,
    replace:
`// Web environment vs Falkon IDE (Tauri native desktop)
else if (typeof navigator === 'object' && !isElectronRenderer) {
\t_userAgent = navigator.userAgent;
\t_isWindows = _userAgent.indexOf('Windows') >= 0;
\t_isMacintosh = _userAgent.indexOf('Macintosh') >= 0;
\t_isIOS = (_userAgent.indexOf('Macintosh') >= 0 || _userAgent.indexOf('iPad') >= 0 || _userAgent.indexOf('iPhone') >= 0) && !!navigator.maxTouchPoints && navigator.maxTouchPoints > 0;
\t_isLinux = _userAgent.indexOf('Linux') >= 0;
\t_isMobile = _userAgent?.indexOf('Mobi') >= 0;
\t// Falkon IDE runs in Tauri — treat as native desktop, not web browser
\tconst _isTauriApp = typeof $globalThis.__TAURI__ !== 'undefined' || true;
\tif (_isTauriApp) { _isNative = true; _isWeb = false; } else { _isWeb = true; }`,
  },

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ 2. lifecycleService.ts
  // │    Upstream fires "Leave site?" browser dialog via event.returnValue.
  // │    In Tauri that dialog freezes the window — neutralise it.
  // └─────────────────────────────────────────────────────────────────────────
  {
    file: 'src/vs/workbench/services/lifecycle/browser/lifecycleService.ts',
    desc: 'Suppress "Leave site?" browser dialog (freezes Tauri window)',
    find:
`\tprivate vetoBeforeUnload(event: BeforeUnloadEvent): void {
\t\tevent.preventDefault();
\t\tevent.returnValue = localize('lifecycleVeto', "Changes that you made may not be saved. Please check press 'Cancel' and try again.");
\t}`,
    replace:
`\tprivate vetoBeforeUnload(_event: BeforeUnloadEvent): void {
\t\t// Falkon/Tauri: suppressed — browser "Leave site?" dialogs freeze the native window
\t}`,
  },

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ 3. builtinExtensionsScannerService.ts
  // │    Upstream gates all extension scanning behind `if (isWeb)`.
  // │    Since we set isNative=true, isWeb=false, this skips all 96 extensions.
  // │    Remove the gate so extensions always load, and cache the result.
  // └─────────────────────────────────────────────────────────────────────────
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/builtinExtensionsScannerService.ts',
    desc: 'Remove `isWeb` import (unused after gate removal)',
    find: `import { isWeb, Language } from '../../../../base/common/platform.js';`,
    replace: `import { Language } from '../../../../base/common/platform.js';`,
  },
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/builtinExtensionsScannerService.ts',
    desc: 'Swap per-call promise array for a single cached Promise<IExtension[]>',
    find: `\tprivate readonly builtinExtensionsPromises: Promise<IExtension>[] = [];`,
    replace: `\t// Cached once at construction — scanBuiltinExtensions() returns instantly on repeated calls\n\tprivate readonly _cachedExtensions!: Promise<IExtension[]>;`,
  },
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/builtinExtensionsScannerService.ts',
    desc: 'Remove isWeb gate — always scan extensions in Tauri desktop app',
    find:
`		if (isWeb) {
\t\t\tconst nlsBaseUrl = productService.extensionsGallery?.nlsBaseUrl;`,
    replace:
`		// Falkon: removed isWeb gate — always scan in native desktop app
\t\t{
\t\t\tconst nlsBaseUrl = productService.extensionsGallery?.nlsBaseUrl;`,
  },
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/builtinExtensionsScannerService.ts',
    desc: 'Assign promises to _cachedExtensions instead of builtinExtensionsPromises',
    find:
`				this.builtinExtensionsPromises = bundledExtensions.map(async e => {`,
    replace:
`				this._cachedExtensions = Promise.all(bundledExtensions.map(async e => {`,
  },
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/builtinExtensionsScannerService.ts',
    desc: 'Close the Promise.all() wrapper and remove the redundant outer if(builtinExtensionsServiceUrl) block close',
    find:
`					};
				});
			}
		}
	}`,
    replace:
`					};
				}));
			}
		}
	}`,
  },
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/builtinExtensionsScannerService.ts',
    desc: 'scanBuiltinExtensions returns cached promise (no rebuild on repeat calls)',
    find: `\tasync scanBuiltinExtensions(): Promise<IExtension[]> {\n\t\treturn [...await Promise.all(this.builtinExtensionsPromises)];\n\t}`,
    replace: `\tasync scanBuiltinExtensions(): Promise<IExtension[]> {\n\t\treturn this._cachedExtensions ?? [];\n\t}`,
  },

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ 4. workbench.ts
  // │    WorkspaceProvider.open: always reuse window via location.href in desktop
  // └─────────────────────────────────────────────────────────────────────────
  {
    file: 'src/vs/code/browser/workbench/workbench.ts',
    desc: 'WorkspaceProvider.open: always reuse window via location.href in desktop',
    find:
`		const targetHref = this.createTargetUrl(workspace, options);
		if (targetHref) {
			if (options?.reuse) {
				mainWindow.location.href = targetHref;
				return true;
			} else {
				let result;
				if (isStandalone()) {
					result = mainWindow.open(targetHref, '_blank', 'toolbar=no'); // ensures to open another 'standalone' window!
				} else {
					result = mainWindow.open(targetHref);
				}

				return !!result;
			}
		}`,
    replace:
`		const targetHref = this.createTargetUrl(workspace, options);
		if (targetHref) {
			mainWindow.location.href = targetHref;
			return true;
		}`,
  },
  {
    file: 'src/vs/code/browser/workbench/workbench.ts',
    desc: 'Target #workbench-container and inject Falkon configurationDefaults',
    find:
`	create(mainWindow.document.body, {
		...config,
		windowIndicator: config.windowIndicator ?? { label: '$(remote)', tooltip: \`\${product.nameShort} Web\` },`,
    replace:
`	create(mainWindow.document.getElementById('workbench-container') || mainWindow.document.body, {
		...config,
		configurationDefaults: {
			'workbench.colorTheme': 'Default Dark Modern',
			'workbench.preferredDarkColorTheme': 'Default Dark Modern',
			'workbench.iconTheme': 'vs-seti',
			'window.titleBarStyle': 'native',
			'window.customTitleBarVisibility': 'never',
			'window.dialogStyle': 'custom',
			'window.menuBarVisibility': 'classic',
			'window.commandCenter': true,
			'workbench.navigationControl.enabled': true,
			'workbench.layoutControl.enabled': true,
			'workbench.tree.renderIndentGuides': 'always',
			'security.workspace.trust.enabled': false,
			'git.enabled': true,
			'git.path': 'git',
			'git.autoRepositoryDetection': true,
			'workbench.colorCustomizations': {
				'statusBar.background': '#181818',
				'statusBar.noFolderBackground': '#181818',
				'statusBar.debuggingBackground': '#181818',
				'statusBar.border': '#2b2b2b'
			},
			...config.configurationDefaults
		},`,
  },
  {
    file: 'src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts',
    desc: 'Import Falkon TauriTerminalBackend in terminal contribution',
    find: `import { getFontSnippets } from '../../../../base/browser/fonts.js';`,
    replace: `import './tauriTerminalBackend.js';\nimport { getFontSnippets } from '../../../../base/browser/fonts.js';`,
  },

];

// ─────────────────────────────────────────────
//  Patcher engine
// ─────────────────────────────────────────────

export function applyPatches() {
  console.log('\n🔧 Applying Falkon upstream patches...');
  let applied = 0, alreadyDone = 0, failed = 0;

  // 0. Deploy Falkon core contributions into build environment
  const tauriTerminalSource = path.join(ROOT, 'falkon/core/tauri-terminal.ts');
  const tauriTerminalDest = path.join(ROOT, 'src/vs/workbench/contrib/terminal/browser/tauriTerminalBackend.ts');
  if (fs.existsSync(tauriTerminalSource)) {
    fs.mkdirSync(path.dirname(tauriTerminalDest), { recursive: true });
    fs.copyFileSync(tauriTerminalSource, tauriTerminalDest);
    console.log('  ✓  DEPLOYED: falkon/core/tauri-terminal.ts → src/vs/workbench/contrib/terminal/browser/tauriTerminalBackend.ts');
  }

  for (const patch of PATCHES) {
    const filePath = path.join(ROOT, patch.file.replace(/\//g, path.sep));

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠  SKIP    (file not found): ${patch.file}`);
      failed++;
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const crlf = raw.includes('\r\n');
    // Work in LF-normalised space for reliable matching
    const content = raw.replace(/\r\n/g, '\n');
    const findNorm = patch.find.replace(/\r\n/g, '\n');
    const replNorm = patch.replace.replace(/\r\n/g, '\n');

    if (content.includes(findNorm)) {
      const patched = content.replace(findNorm, replNorm);
      fs.writeFileSync(filePath, crlf ? patched.replace(/\n/g, '\r\n') : patched, 'utf8');
      console.log(`  ✓  PATCHED : ${patch.file}\n     └─ ${patch.desc}`);
      applied++;
    } else if (content.includes(replNorm)) {
      console.log(`  –  ALREADY : ${patch.file}\n     └─ ${patch.desc}`);
      alreadyDone++;
    } else {
      console.error(`  ✗  FAILED  : ${patch.file}\n     └─ ${patch.desc}\n     └─ Anchor text not found — upstream may have changed this area.`);
      failed++;
    }
  }

  const total = PATCHES.length;
  console.log(`\n  Patches: ${applied} applied, ${alreadyDone} already in place, ${failed} failed / ${total} total`);

  if (failed > 0) {
    console.error(`\n❌ ${failed} patch(es) failed. Update patch-upstream.js to match the new upstream text.\n`);
    process.exit(1);
  }
  console.log('✅ All Falkon patches applied!\n');
}

// Allow running standalone:  node patch-upstream.js
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  applyPatches();
}
