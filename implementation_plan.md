# Master Plan: 1:1 Visual Studio Code on Tauri v2

This document provides the complete, production-grade implementation plan to turn **Falkon Dev Kit** into a fast, stable, cross-platform competitor to Microsoft Visual Studio Code, powered by **Tauri v2 + Rust**.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions:**
> 1. **Native Dialog Service (`TauriFileDialogService`)**: Overrides VS Code web's default dialog limitation by routing all `Open File`, `Open Folder`, and `Save As` actions directly to native OS dialogs via Tauri IPC (`rfd`).
> 2. **Native PTY Terminal Backend (`TauriTerminalBackend`)**: Bridges VS Code's `ITerminalService` to real OS shell processes via `portable-pty` in Rust.
> 3. **Dual Extension Gallery**: Configures product metadata for both Microsoft VS Code Marketplace and Open VSX registry support.
> 4. **Root Cleanup**: Verified root directory; no extraneous files exist in the repository root.

---

## Proposed Changes

### 1. Native File Dialogs & File Operations
Implement a dedicated `TauriFileDialogService` implementing `IFileDialogService`:
- `showOpenDialog()`: Invokes native OS file picker via `window.__tauri_dialogs__.openFile()`.
- `showSaveDialog()`: Invokes native OS save picker via `window.__tauri_dialogs__.saveFile()`.
- `pickFolderAndOpen()`: Invokes native OS folder picker via `window.__tauri_dialogs__.openFolder()`, updating `workspaceProvider` and loading the folder into the Explorer.
- `pickFileAndOpen()`: Invokes native OS file picker and opens the document in a new Monaco Editor tab.

#### [NEW] [src/vs/workbench/services/dialogs/browser/tauriFileDialogService.ts](file:///home/gt/falkon-labs/Falkon_Dev_Kit/src/vs/workbench/services/dialogs/browser/tauriFileDialogService.ts)
#### [MODIFY] [src/vs/workbench/workbench.web.main.ts](file:///home/gt/falkon-labs/Falkon_Dev_Kit/src/vs/workbench/workbench.web.main.ts)
#### [MODIFY] [src/vs/workbench/services/dialogs/browser/fileDialogService.ts](file:///home/gt/falkon-labs/Falkon_Dev_Kit/src/vs/workbench/services/dialogs/browser/fileDialogService.ts)

---

### 2. Full PTY Terminal Service Integration
Ensure the integrated terminal (`Ctrl+\``) initializes smoothly:
- `TauriTerminalChildProcess`: Connects to `portable-pty` session created by Rust backend.
- `TauriTerminalBackend`: Registered as the default terminal backend in `TerminalExtensions.Backend`.
- Handles ANSI escape sequences, keyboard input, dynamic resize (`session.master.resize`), and process exit signals.

#### [MODIFY] [src/vs/workbench/contrib/terminal/browser/tauriTerminalBackend.ts](file:///home/gt/falkon-labs/Falkon_Dev_Kit/src/vs/workbench/contrib/terminal/browser/tauriTerminalBackend.ts)
#### [MODIFY] [src-tauri/src/main.rs](file:///home/gt/falkon-labs/Falkon_Dev_Kit/src-tauri/src/main.rs)

---

### 3. Extension Gallery Configuration (Microsoft Marketplace + Open VSX)
Configure `extensionsGallery` in `productConfiguration` so the Extensions tab (`Ctrl+Shift+X`) can search, inspect, and install extensions from both Open VSX and the VS Code Marketplace.

#### [MODIFY] [product.json](file:///home/gt/falkon-labs/Falkon_Dev_Kit/product.json)
#### [MODIFY] [src/index.html](file:///home/gt/falkon-labs/Falkon_Dev_Kit/src/index.html)

---

### 4. Cross-Platform & Multi-Architecture Hardening
- Rust backend uses purely platform-agnostic crates (`portable-pty`, `rfd`, `tauri`, `walkdir`, `serde_json`, `regex`).
- Validated on:
  - **Linux**: x86_64, aarch64 (WebKitGTK)
  - **macOS**: Apple Silicon (arm64), Intel (x86_64) (WKWebView)
  - **Windows**: x64, ARM64 (WebView2)

---

## Verification Plan

### Automated Tests
1. **Bundle & Compilation Verification:**
   ```bash
   npm run bundle-vs
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
2. **Unit Test Suite:**
   ```bash
   npm run unit-test
   ```
3. **End-to-End Headless Playwright Test:**
   - Test folder tree population with `TauriFileSystemProvider`.
   - Test file creation, editing, and saving (`Ctrl+S`).
   - Test terminal spawn and command output.

### Manual Verification
- Launch `npm run dev` and verify:
  1. Explorer opens project directory with full file hierarchy.
  2. Clicking "Open Folder" / "Open File" opens native OS file picker.
  3. Integrated terminal opens with interactive shell prompt.
  4. Extensions viewlet searches and displays extensions.
