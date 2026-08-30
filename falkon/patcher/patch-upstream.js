/**
 * patch-upstream.js
 *
 * Applies Falkon IDE–specific patches to upstream VS Code source files.
 * Run automatically by bundle-vscode.js before bundling.
 *
 * Strategy: ALL Falkon logic that touches Microsoft's src/vs/** files
 * lives here as declarative text patches. The actual source files are NEVER committed
 * with custom business logic — this script re-applies them on every build, so
 * upstream git pulls are completely safe.
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
  // │ 1. lifecycleService.ts
  // │    Upstream fires "Leave site?" browser dialog via event.returnValue.
  // │    In Tauri that dialog freezes the window — neutralise it.
  // └─────────────────────────────────────────────────────────────────────────
  {
    file: 'src/vs/workbench/services/lifecycle/browser/lifecycleService.ts',
    desc: 'Remove unused localize import in lifecycleService.ts',
    find: `import { localize } from '../../../../nls.js';\nimport { InstantiationType`,
    replace: `import { InstantiationType`,
  },
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
  // │ 2. workbench.ts
  // │    WorkspaceProvider.open: always reuse window via location.href in desktop
  // └─────────────────────────────────────────────────────────────────────────
  {
    file: 'src/vs/code/browser/workbench/workbench.ts',
    desc: 'WorkspaceProvider.open: always reuse window via location.href in desktop',
    find:
`\t\tconst targetHref = this.createTargetUrl(workspace, options);
\t\tif (targetHref) {
\t\t\tif (options?.reuse) {
\t\t\t\tmainWindow.location.href = targetHref;
\t\t\t\treturn true;
\t\t\t} else {
\t\t\t\tlet result;
\t\t\t\tif (isStandalone()) {
\t\t\t\t\tresult = mainWindow.open(targetHref, '_blank', 'toolbar=no'); // ensures to open another 'standalone' window!
\t\t\t\t} else {
\t\t\t\t\tresult = mainWindow.open(targetHref);
\t\t\t\t}

\t\t\t\treturn !!result;
\t\t\t}
\t\t}`,
    replace:
`\t\tconst targetHref = this.createTargetUrl(workspace, options);
\t\tif (targetHref) {
\t\t\tmainWindow.location.href = targetHref;
\t\t\treturn true;
\t\t}`,
  },
  {
    file: 'src/vs/code/browser/workbench/workbench.ts',
    desc: 'Target #workbench-container and inject Falkon configurationDefaults',
    find:
`\tcreate(mainWindow.document.body, {
\t\t...config,
\t\twindowIndicator: config.windowIndicator ?? { label: '$(remote)', tooltip: \`\${product.nameShort} Web\` },`,
    replace:
`\tcreate(mainWindow.document.getElementById('workbench-container') || mainWindow.document.body, {
\t\t...config,
\t\twindowIndicator: config.windowIndicator ?? { label: 'Falkon', tooltip: 'Falkon IDE' },
\t\tconfigurationDefaults: {
\t\t\t'workbench.colorTheme': 'Default Dark Modern',
\t\t\t'workbench.preferredDarkColorTheme': 'Default Dark Modern',
\t\t\t'workbench.iconTheme': 'vs-seti',
\t\t\t'window.titleBarStyle': 'native',
\t\t\t'window.customTitleBarVisibility': 'never',
\t\t\t'window.dialogStyle': 'custom',
\t\t\t'window.menuBarVisibility': 'classic',
\t\t\t'window.commandCenter': true,
\t\t\t'workbench.navigationControl.enabled': true,
\t\t\t'workbench.layoutControl.enabled': true,
\t\t\t'workbench.tree.renderIndentGuides': 'always',
\t\t\t'security.workspace.trust.enabled': false,
\t\t\t'git.enabled': true,
\t\t\t'git.path': 'git',
\t\t\t'git.autoRepositoryDetection': true,
\t\t\t'extensions.verifySignature': false,
\t\t\t'terminal.integrated.gpuAcceleration': 'off',
\t\t\t'terminal.integrated.smoothScrolling': false,
\t\t\t'terminal.integrated.cursorBlinking': true,
\t\t\t'terminal.integrated.fastScrollSensitivity': 5,
\t\t\t'workbench.colorCustomizations': {
\t\t\t\t'statusBar.background': '#181818',
\t\t\t\t'statusBar.noFolderBackground': '#181818',
\t\t\t\t'statusBar.debuggingBackground': '#181818',
\t\t\t\t'statusBar.border': '#2b2b2b'
\t\t\t},
\t\t\t...config.configurationDefaults
\t\t},`,
  },
  {
    file: 'src/vs/code/browser/workbench/workbench.ts',
    desc: 'Remove unused isStandalone import in workbench.ts',
    find: `import { isStandalone } from '../../../base/browser/browser.js';\nimport { addDisposableListener }`,
    replace: `import { addDisposableListener }`,
  },
  {
    file: 'src/vs/code/browser/workbench/workbench.ts',
    desc: 'Support file:// URL decoding for remote authority in WorkspaceProvider',
    find:
`\t\t\t\t// Folder
\t\t\t\tcase WorkspaceProvider.QUERY_PARAM_FOLDER:
\t\t\t\t\tif (config.remoteAuthority && value.startsWith(posix.sep)) {
\t\t\t\t\t\t// when connected to a remote and having a value
\t\t\t\t\t\t// that is a path (begins with a \`/\`), assume this
\t\t\t\t\t\t// is a vscode-remote resource as simplified URL.
\t\t\t\t\t\tworkspace = { folderUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
\t\t\t\t\t} else {
\t\t\t\t\t\tworkspace = { folderUri: URI.parse(value) };
\t\t\t\t\t}
\t\t\t\t\tfoundWorkspace = true;
\t\t\t\t\tbreak;

\t\t\t\t// Workspace
\t\t\t\tcase WorkspaceProvider.QUERY_PARAM_WORKSPACE:
\t\t\t\t\tif (config.remoteAuthority && value.startsWith(posix.sep)) {
\t\t\t\t\t\t// when connected to a remote and having a value
\t\t\t\t\t\t// that is a path (begins with a \`/\`), assume this
\t\t\t\t\t\t// is a vscode-remote resource as simplified URL.
\t\t\t\t\t\tworkspace = { workspaceUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
\t\t\t\t\t} else {
\t\t\t\t\t\tworkspace = { workspaceUri: URI.parse(value) };
\t\t\t\t\t}
\t\t\t\t\tfoundWorkspace = true;
\t\t\t\t\tbreak;`,
    replace:
`\t\t\t\t// Folder
\t\t\t\tcase WorkspaceProvider.QUERY_PARAM_FOLDER:
\t\t\t\t\tif (config.remoteAuthority) {
\t\t\t\t\t\tlet folderPath = value;
\t\t\t\t\t\tif (folderPath.startsWith('file://')) {
\t\t\t\t\t\t\ttry { folderPath = URI.parse(folderPath).path; } catch (_) {}
\t\t\t\t\t\t}
\t\t\t\t\t\tif (folderPath.startsWith(posix.sep)) {
\t\t\t\t\t\t\tworkspace = { folderUri: URI.from({ scheme: Schemas.vscodeRemote, path: folderPath, authority: config.remoteAuthority }) };
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tworkspace = { folderUri: URI.parse(value) };
\t\t\t\t\t\t}
\t\t\t\t\t} else {
\t\t\t\t\t\tworkspace = { folderUri: URI.parse(value) };
\t\t\t\t\t}
\t\t\t\t\tfoundWorkspace = true;
\t\t\t\t\tbreak;

\t\t\t\t// Workspace
\t\t\t\tcase WorkspaceProvider.QUERY_PARAM_WORKSPACE:
\t\t\t\t\tif (config.remoteAuthority) {
\t\t\t\t\t\tlet wsPath = value;
\t\t\t\t\t\tif (wsPath.startsWith('file://')) {
\t\t\t\t\t\t\ttry { wsPath = URI.parse(wsPath).path; } catch (_) {}
\t\t\t\t\t\t}
\t\t\t\t\t\tif (wsPath.startsWith(posix.sep)) {
\t\t\t\t\t\t\tworkspace = { workspaceUri: URI.from({ scheme: Schemas.vscodeRemote, path: wsPath, authority: config.remoteAuthority }) };
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tworkspace = { workspaceUri: URI.parse(value) };
\t\t\t\t\t\t}
\t\t\t\t\t} else {
\t\t\t\t\t\tworkspace = { workspaceUri: URI.parse(value) };
\t\t\t\t\t}
\t\t\t\t\tfoundWorkspace = true;
\t\t\t\t\tbreak;`,
  },
  {
    file: 'src/vs/code/browser/workbench/workbench.ts',
    desc: 'Support file:// scheme in encodeWorkspacePath for remote authority',
    find: `\tprivate encodeWorkspacePath(uri: URI): string {\n\t\tif (this.config.remoteAuthority && uri.scheme === Schemas.vscodeRemote) {`,
    replace: `\tprivate encodeWorkspacePath(uri: URI): string {\n\t\tif (this.config.remoteAuthority && (uri.scheme === Schemas.vscodeRemote || uri.scheme === Schemas.file)) {`,
  },
  {
    file: 'src/vs/workbench/services/label/common/labelService.ts',
    desc: 'Omit [vscode-remote] suffix for local sidecar in labelService.ts',
    find:
`\tprivate appendWorkspaceSuffix(label: string, uri: URI): string {
\t\tconst formatting = this.findFormatting(uri);
\t\tconst suffix = formatting && (typeof formatting.workspaceSuffix === 'string') ? formatting.workspaceSuffix : undefined;

\t\treturn suffix ? \`\${label} [\${suffix}]\` : label;
\t}`,
    replace:
`\tprivate appendWorkspaceSuffix(label: string, uri: URI): string {
\t\tconst formatting = this.findFormatting(uri);
\t\tconst suffix = formatting && (typeof formatting.workspaceSuffix === 'string') ? formatting.workspaceSuffix : undefined;

\t\tif (suffix === 'vscode-remote' || suffix === '127.0.0.1:9888' || uri.authority === '127.0.0.1:9888') {
\t\t\treturn label;
\t\t}

\t\treturn suffix ? \`\${label} [\${suffix}]\` : label;
\t}`,
  },

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ 3. abstractFileDialogService.ts (Native Desktop File/Folder Pickers)
  // └─────────────────────────────────────────────────────────────────────────
  {
    file: 'src/vs/workbench/services/dialogs/browser/abstractFileDialogService.ts',
    desc: 'Delegate pickFolderAndOpenSimplified to Tauri native folder dialog',
    find:
`\tprotected async pickFolderAndOpenSimplified(schema: string, options: IPickAndOpenOptions): Promise<void> {
\t\tconst title = nls.localize('openFolder.title', 'Open Folder');
\t\tconst availableFileSystems = this.addFileSchemaIfNeeded(schema, true);

\t\tconst uris = await this.pickResource({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, defaultUri: options.defaultUri, title, availableFileSystems });
\t\tconst uri = uris?.[0];
\t\tif (uri) {
\t\t\treturn this.hostService.openWindow([{ folderUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
\t\t}`,
    replace:
`\tprotected async pickFolderAndOpenSimplified(schema: string, options: IPickAndOpenOptions): Promise<void> {
\t\tif ((window as any).__tauri_dialogs__) {
\t\t\tconst folderPath = await (window as any).__tauri_dialogs__.openFolder();
\t\t\tif (folderPath && typeof folderPath === 'string') {
\t\t\t\tconst remoteAuth = options.remoteAuthority || this.environmentService.remoteAuthority;
\t\t\t\tconst norm = folderPath.replace(/\\\\/g, '/').replace(/^([A-Za-z]):/, '/$1:');
\t\t\t\tconst normPath = norm.startsWith('/') ? norm : '/' + norm;
\t\t\t\tconst fileUri = remoteAuth
\t\t\t\t\t? URI.from({ scheme: Schemas.vscodeRemote, authority: remoteAuth, path: normPath })
\t\t\t\t\t: URI.file(folderPath);
\t\t\t\treturn this.hostService.openWindow([{ folderUri: fileUri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: remoteAuth });
\t\t\t}
\t\t\treturn;
\t\t}
\t\tconst title = nls.localize('openFolder.title', 'Open Folder');
\t\tconst availableFileSystems = this.addFileSchemaIfNeeded(schema, true);

\t\tconst uris = await this.pickResource({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, defaultUri: options.defaultUri, title, availableFileSystems });
\t\tconst uri = uris?.[0];
\t\tif (uri) {
\t\t\treturn this.hostService.openWindow([{ folderUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
\t\t}`,
  },
  {
    file: 'src/vs/workbench/services/dialogs/browser/abstractFileDialogService.ts',
    desc: 'Delegate pickFileAndOpenSimplified to Tauri native file dialog',
    find:
`\tprotected async pickFileAndOpenSimplified(schema: string, options: IPickAndOpenOptions, preferNewWindow: boolean): Promise<void> {
\t\tconst title = nls.localize('openFile.title', 'Open File');
\t\tconst availableFileSystems = this.addFileSchemaIfNeeded(schema);

\t\tconst uris = await this.pickResource({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, defaultUri: options.defaultUri, title, availableFileSystems });
\t\tconst uri = uris?.[0];
\t\tif (uri) {
\t\t\tthis.addFileToRecentlyOpened(uri);

\t\t\tif (options.forceNewWindow || preferNewWindow) {
\t\t\t\tawait this.hostService.openWindow([{ fileUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
\t\t\t} else {
\t\t\t\tawait this.editorService.openEditors([{ resource: uri, options: { source: EditorOpenSource.USER, pinned: true } }], undefined, { validateTrust: true });
\t\t\t}
\t\t}`,
    replace:
`\tprotected async pickFileAndOpenSimplified(schema: string, options: IPickAndOpenOptions, preferNewWindow: boolean): Promise<void> {
\t\tif ((window as any).__tauri_dialogs__) {
\t\t\tconst filePath = await (window as any).__tauri_dialogs__.openFile();
\t\t\tif (filePath && typeof filePath === 'string') {
\t\t\t\tconst remoteAuth = options.remoteAuthority || this.environmentService.remoteAuthority;
\t\t\t\tconst norm = filePath.replace(/\\\\/g, '/').replace(/^([A-Za-z]):/, '/$1:');
\t\t\t\tconst normPath = norm.startsWith('/') ? norm : '/' + norm;
\t\t\t\tconst fileUri = remoteAuth
\t\t\t\t\t? URI.from({ scheme: Schemas.vscodeRemote, authority: remoteAuth, path: normPath })
\t\t\t\t\t: URI.from({ scheme: 'file', path: normPath });
\t\t\t\tthis.addFileToRecentlyOpened(fileUri);
\t\t\t\tif (options.forceNewWindow || preferNewWindow) {
\t\t\t\t\tawait this.hostService.openWindow([{ fileUri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: remoteAuth });
\t\t\t\t} else {
\t\t\t\t\tawait this.editorService.openEditors([{ resource: fileUri, options: { source: EditorOpenSource.USER, pinned: true } }], undefined, { validateTrust: true });
\t\t\t\t}
\t\t\t\treturn;
\t\t\t}
\t\t\treturn;
\t\t}
\t\tconst title = nls.localize('openFile.title', 'Open File');
\t\tconst availableFileSystems = this.addFileSchemaIfNeeded(schema);

\t\tconst uris = await this.pickResource({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, defaultUri: options.defaultUri, title, availableFileSystems });
\t\tconst uri = uris?.[0];
\t\tif (uri) {
\t\t\tthis.addFileToRecentlyOpened(uri);

\t\t\tif (options.forceNewWindow || preferNewWindow) {
\t\t\t\tawait this.hostService.openWindow([{ fileUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
\t\t\t} else {
\t\t\t\tawait this.editorService.openEditors([{ resource: uri, options: { source: EditorOpenSource.USER, pinned: true } }], undefined, { validateTrust: true });
\t\t\t}
\t\t}`,
  },
  {
    file: 'src/vs/workbench/services/dialogs/browser/abstractFileDialogService.ts',
    desc: 'Delegate pickFileToSaveSimplified to Tauri native save file dialog',
    find:
`\tprotected async pickFileToSaveSimplified(schema: string, options: ISaveDialogOptions): Promise<URI | undefined> {
\t\tif (!options.availableFileSystems) {
\t\t\toptions.availableFileSystems = this.addFileSchemaIfNeeded(schema);
\t\t}

\t\toptions.title = nls.localize('saveFileAs.title', 'Save As');
\t\tconst uri = await this.saveRemoteResource(options);

\t\tif (uri) {
\t\t\tthis.addFileToRecentlyOpened(uri);
\t\t}

\t\treturn uri;
\t}`,
    replace:
`\tprotected async pickFileToSaveSimplified(schema: string, options: ISaveDialogOptions): Promise<URI | undefined> {
\t\tif ((window as any).__tauri_dialogs__) {
\t\t\tconst defaultName = options.defaultUri ? options.defaultUri.path.split('/').pop() : undefined;
\t\t\tconst filePath = await (window as any).__tauri_dialogs__.saveFile(defaultName);
\t\t\tif (filePath && typeof filePath === 'string') {
\t\t\t\tconst remoteAuth = this.environmentService.remoteAuthority;
\t\t\t\tconst norm = filePath.replace(/\\\\/g, '/').replace(/^([A-Za-z]):/, '/$1:');
\t\t\t\tconst normPath = norm.startsWith('/') ? norm : '/' + norm;
\t\t\t\tconst fileUri = remoteAuth
\t\t\t\t\t? URI.from({ scheme: Schemas.vscodeRemote, authority: remoteAuth, path: normPath })
\t\t\t\t\t: URI.from({ scheme: 'file', path: normPath });
\t\t\t\tthis.addFileToRecentlyOpened(fileUri);
\t\t\t\treturn fileUri;
\t\t\t}
\t\t\treturn undefined;
\t\t}
\t\tif (!options.availableFileSystems) {
\t\t\toptions.availableFileSystems = this.addFileSchemaIfNeeded(schema);
\t\t}

\t\toptions.title = nls.localize('saveFileAs.title', 'Save As');
\t\tconst uri = await this.saveRemoteResource(options);

\t\tif (uri) {
\t\t\tthis.addFileToRecentlyOpened(uri);
\t\t}

\t\treturn uri;
\t}`,
  },
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/builtinExtensionsScannerService.ts',
    desc: 'Always parse DOM builtin extensions in browser BuiltinExtensionsScannerService',
    find:
`\t\t\t\tif (environmentService.isBuilt) {
\t\t\t\t\t// Built time configuration (do NOT modify)
\t\t\t\t\tbundledExtensions = [/*BUILD->INSERT_BUILTIN_EXTENSIONS*/];
\t\t\t\t} else {
\t\t\t\t\t// Find builtin extensions by checking for DOM
\t\t\t\t\t// eslint-disable-next-line no-restricted-syntax
\t\t\t\t\tconst builtinExtensionsElement = mainWindow.document.getElementById('vscode-workbench-builtin-extensions');
\t\t\t\t\tconst builtinExtensionsElementAttribute = builtinExtensionsElement ? builtinExtensionsElement.getAttribute('data-settings') : undefined;
\t\t\t\t\tif (builtinExtensionsElementAttribute) {
\t\t\t\t\t\ttry {
\t\t\t\t\t\t\tbundledExtensions = JSON.parse(builtinExtensionsElementAttribute);
\t\t\t\t\t\t} catch (error) { /* ignore error*/ }
\t\t\t\t\t}
\t\t\t\t}`,
    replace:
`\t\t\t\t// Find builtin extensions by checking for DOM
\t\t\t\t// eslint-disable-next-line no-restricted-syntax
\t\t\t\tconst builtinExtensionsElement = mainWindow.document.getElementById('vscode-workbench-builtin-extensions');
\t\t\t\tconst builtinExtensionsElementAttribute = builtinExtensionsElement ? builtinExtensionsElement.getAttribute('data-settings') : undefined;
\t\t\t\tif (builtinExtensionsElementAttribute) {
\t\t\t\t\ttry {
\t\t\t\t\t\tbundledExtensions = JSON.parse(builtinExtensionsElementAttribute);
\t\t\t\t\t} catch (error) { /* ignore error*/ }
\t\t\t\t}`,
  },
  {
    file: 'src/vs/server/node/server.main.ts',
    desc: 'Resolve server builtin extensions directory to root extensions folder',
    find:
`const APP_ROOT = dirname(FileAccess.asFileUri('').fsPath);
const BUILTIN_EXTENSIONS_FOLDER_PATH = join(APP_ROOT, 'extensions');
args['builtin-extensions-dir'] = BUILTIN_EXTENSIONS_FOLDER_PATH;`,
    replace:
`const APP_ROOT = dirname(FileAccess.asFileUri('').fsPath);
let BUILTIN_EXTENSIONS_FOLDER_PATH = join(APP_ROOT, 'extensions');
if (!fs.existsSync(BUILTIN_EXTENSIONS_FOLDER_PATH) || fs.readdirSync(BUILTIN_EXTENSIONS_FOLDER_PATH).length <= 5) {
\tconst parentExt = join(APP_ROOT, '..', 'extensions');
\tif (fs.existsSync(parentExt)) {
\t\tBUILTIN_EXTENSIONS_FOLDER_PATH = parentExt;
\t}
}
args['builtin-extensions-dir'] = args['builtin-extensions-dir'] || BUILTIN_EXTENSIONS_FOLDER_PATH;`,
  },
];

// ─────────────────────────────────────────────
//  Patcher engine
// ─────────────────────────────────────────────

export function applyPatches() {
  console.log('\n🔧 Applying Falkon upstream patches...');
  let applied = 0, alreadyDone = 0, failed = 0;

  for (const patch of PATCHES) {
    const filePath = path.join(ROOT, patch.file.replace(/\//g, path.sep));

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠  SKIP    (file not found): ${patch.file}`);
      failed++;
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const crlf = raw.includes('\r\n');
    const content = raw.replace(/\r\n/g, '\n');
    const findNorm = patch.find.replace(/\r\n/g, '\n');
    const replNorm = patch.replace.replace(/\r\n/g, '\n');

    if (content.includes(replNorm)) {
      console.log(`  –  ALREADY : ${patch.file}\n     └─ ${patch.desc}`);
      alreadyDone++;
    } else if (content.includes(findNorm)) {
      const patched = content.replace(findNorm, replNorm);
      fs.writeFileSync(filePath, crlf ? patched.replace(/\n/g, '\r\n') : patched, 'utf8');
      console.log(`  ✓  PATCHED : ${patch.file}\n     └─ ${patch.desc}`);
      applied++;
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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  applyPatches();
}
