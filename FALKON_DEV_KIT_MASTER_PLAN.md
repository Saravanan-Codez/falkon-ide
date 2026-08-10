# Master Architecture & Implementation Plan: Falkon Dev Kit (1:1 VS Code on Tauri v2)

This document provides the complete, production-grade architecture and roadmap to make **Falkon Dev Kit** a true, high-performance competitor to Microsoft Visual Studio Code, built on **Tauri v2 + Rust**.

---

## 1. Executive Summary & Value Proposition

Microsoft VS Code is built on Electron, which bundles a full Chromium browser and Node.js runtime per window. This architecture has notable drawbacks:
* **High Memory Footprint**: 400 MB to 1.5 GB+ RAM on idle.
* **Slow Cold Startup**: 2.5s – 5.0s startup latency.
* **Proprietary Marketplace Lock-in**: Microsoft restricts its extension gallery and C/C++ debuggers from open-source forks.

**Falkon Dev Kit** solves this by packaging the complete **3.94 million lines of VS Code's core workbench and Monaco editor** into a **Tauri v2 + Rust** desktop runtime:
* **Idle Memory**: ~60–90 MB RAM (5x–10x reduction).
* **Startup Speed**: < 400ms cold start.
* **Native Rust Services**: Multithreaded file I/O, `portable-pty` terminal, `ripgrep` search, and native OS dialogs.
* **Open & Dual Extension Ecosystem**: Connects to both Open VSX and the VS Code Marketplace.

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 VS Code Web Workbench                                  │
│                              (3.94 Million Lines of Code)                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Monaco Editor Engine (Syntax, Diff, Multi-cursor, Minimap, AST tokens)               │
│ • Workbench UI Shell (Titlebar, Activity Bar, Sidebars, Editor Grid, Statusbar)        │
│ • 80+ Core Contributions (Explorer, Search, SCM/Git, Terminal, Settings, Keybindings) │
│ • 425 Component CSS Stylesheets with Inlined Codicon Vector Fonts                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                              Tauri IPC Bridge Layer
                                           │
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                Tauri v2 + Rust Backend                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • TauriFileSystemProvider   → Native OS disk operations (file:// scheme)               │
│ • TauriFileDialogService    → Native OS file & folder dialogs via rfd                  │
│ • TauriTerminalBackend      → Multi-platform PTY streams via portable-pty             │
│ • Ripgrep Search Service    → Native multithreaded regex search                        │
│ • Local Git Service         → libgit2 / git CLI integration                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Features Implementation

### A. Native File & Folder Dialogs (`TauriFileDialogService`)
* **Problem**: In web environments, `IFileDialogService` throws errors or uses limited browser APIs for opening folders.
* **Solution**: Implement `TauriFileDialogService` implementing `IFileDialogService`:
  * `showOpenDialog()`: Native OS open file dialog via `rfd`.
  * `showSaveDialog()`: Native OS save file dialog via `rfd`.
  * `pickFolderAndOpen()`: Native OS open folder dialog; automatically persists and reloads workspace into the Explorer tree.
  * `pickFileAndOpen()`: Opens selected files directly into new editor tabs.

### B. Interactive PTY Terminal (`TauriTerminalBackend`)
* **Problem**: VS Code's web terminal view needs a live stream connection to native shell processes.
* **Solution**: Implement `TauriTerminalBackend` (registered in `TerminalExtensions.Backend`) and `TauriTerminalChildProcess`:
  * Spawns default OS shells (`/bin/bash`, `zsh` on Unix/macOS; `powershell.exe`, `cmd.exe` on Windows).
  * Streams ANSI escape codes and data events bi-directionally over Tauri IPC.
  * Dynamically resizes PTY dimensions on editor layout changes.

### C. File System & Auto-Saving (`TauriFileSystemProvider`)
* Registered as the provider for `Schemas.file` (`file://` URIs).
* Supports `stat`, `readdir`, `readFile`, `writeFile`, `mkdir`, `delete`, `rename`, `copy`.
* Seamless `Ctrl+S` saving and automatic debounced file watching.

### D. Dual Extension Gallery (Microsoft Marketplace + Open VSX)
* Configured `extensionsGallery` in `product.json` and `src/index.html`:
  * Direct access to Open VSX (`open-vsx.org`) and VS Code Marketplace.
  * Search, install, update, and manage extensions directly within the Extensions tab (`Ctrl+Shift+X`).

---

## 4. Cross-Platform & Multi-Architecture Compatibility

The Rust backend is built purely on platform-agnostic, multi-arch crates:
* **Linux**: `x86_64`, `aarch64` (WebKitGTK, Wayland/X11)
* **macOS**: `arm64` (Apple Silicon M1/M2/M3/M4), `x86_64` (Intel) (WKWebView)
* **Windows**: `x64`, `ARM64` (WebView2)

---

## 5. Build, Development & Release Lifecycle

```bash
# 1. Transpile all 5,800+ VS Code TypeScript modules and bundle workbench & CSS
npm run bundle-vs

# 2. Launch live Tauri development window
npm run dev

# 3. Execute unit tests
npm run unit-test

# 4. Create production release binaries (.deb, .AppImage, .dmg, .msi)
npm run tauri build
```
