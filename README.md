# ⚡ Falkon DevKit — VS Code Recreated in Tauri v2

A high-performance, lightweight, cross-platform desktop IDE that recreates **Visual Studio Code** using **Tauri v2 + Rust** instead of Electron.

---

## 🤔 Why This Project? (Why VS Code in Tauri?)

Visual Studio Code is the world's most popular code editor, but its traditional **Electron** runtime comes with significant resource overhead:
- ❌ **Heavy RAM Consumption:** Electron bundles a full Chromium browser process and Node.js runtime for every window, consuming 500MB to 1.5GB+ of idle RAM.
- ❌ **Large Binary Footprint:** Installers exceed 250MB-350MB+, taking up excessive disk space and memory bandwidth.
- ❌ **Background CPU Overhead:** High idle CPU usage from multi-process Electron IPC context switches.

### 💡 The Solution: Rebuilding VS Code on Tauri v2

**Falkon DevKit** leverages the official open-source VS Code source code (`microsoft/vscode`), but replaces Electron with **Tauri v2 + Rust**:

| Feature / Metric | Standard VS Code (Electron) | Falkon DevKit (Tauri v2 + Rust) |
| :--- | :--- | :--- |
| **Idle Memory (RAM)** | ~500 MB - 1.5 GB | **~100 MB - 250 MB (70-80% Reduction)** |
| **Installer Size** | ~250 MB - 350 MB | **~60 MB - 90 MB (65%+ Lighter)** |
| **Native Renderer** | Custom Bundled Chromium | **OS Native Webview (WebView2 / WebKit / WebKitGTK)** |
| **Backend Core** | Heavy C++ / Node.js Electron IPC | **Blazing-Fast Rust Async IPC + Native System Calls** |
| **File Explorer Dialogs** | Electron Dialog Bridge | **Native OS File Explorer (Cross-Platform)** |
| **PTY Terminal** | `node-pty` Native Module | **Portable-PTY Rust System Threads** |
| **Text Search Engine** | Process-Spawned Ripgrep | **Rust Ripgrep IPC Engine** |

---

## ✨ Key Features & 1:1 VS Code Parity

- 🎯 **1:1 VS Code Interface & UX:** Full VS Code Workbench (Title Bar, Command Center, Activity Bar, Sidebars, Editor Groups, Status Bar, Panel, Breadcrumbs).
- 📁 **Native OS File Explorer Integration:** `Open Folder...`, `Open File...`, and `Save As...` trigger native Windows File Explorer, macOS Finder, and Linux GTK File Pickers across platforms.
- 🪟 **Native Windows Controls:** Custom titlebar with responsive Minimize, Maximize/Restore, and Close buttons featuring native hover effects and drag-region protection.
- 🤖 **Integrated AI Agents Support:** Includes dedicated **"Open in Agents"** title bar controls and agent session workflows.
- 🖥️ **Cross-Platform Integrated PTY Terminal:** Multi-session terminal powered by Rust `portable-pty` supporting PowerShell, CMD, Bash, and Zsh.
- 🔄 **Upstream VS Code Release Sync:** Automated workflow to pull and merge new upstream VS Code releases (`microsoft/vscode`) into a dedicated `dev-updates` branch.

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                   VS Code Web Workbench Frontend                       │
│      (TypeScript, Monaco Editor, React/CSS, Command Center UI)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Tauri v2 IPC Bridge
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri Rust Core (src-tauri)                     │
│  - Native File Dialogs (rfd)       - Ripgrep Text Search (rg)        │
│  - System File System Access (fs)  - Integrated PTY (portable-pty)     │
│  - Native Window Management        - Git SCM Commands                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Port 9888 / HTTP Stream
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Node.js Extension Host Sidecar (server-main.js)        │
│         (Language Servers, VS Code Extensions, Debuggers)              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚦 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (`node -v`)
- **npm**: v9+ (`npm -v`)
- **Rust**: Stable Rust toolchain ([rustup.rs](https://rustup.rs/))

### 2. Installation
Clone the repository and install npm dependencies:
```bash
git clone https://github.com/Saravanan-Codez/Falkon_Dev_Kit.git
cd Falkon_Dev_Kit
npm install
```

### 3. Run in Development Mode
Launch the app in Tauri dev mode:
```bash
npm run dev
```
*This command automatically compiles built-in extensions, packages workbench assets into `src/dist`, and launches the Tauri window.*

---

## 📦 Building Production Installers

To build all installer targets for your operating system:
```bash
npm run build
```

To build **only a specific target format** (saving compilation time):
```bash
npm run build:nsis       # Fast Windows Setup (.exe) installer
npm run build:msi        # Windows (.msi) installer
npm run build:dmg        # macOS (.dmg) disk image
npm run build:deb        # Linux (.deb) package
npm run build:appimage   # Linux (.AppImage) standalone binary
```

The output installers will be generated in `src-tauri/target/release/bundle/`.

👉 **For complete platform-specific setup and CI/CD documentation, see [BUILDING.md](file:///C:/Users/vbox/Falkon_Dev_Kit/BUILDING.md).**

---

## 🔄 Upstream VS Code Update Strategy (`dev-updates`)

To keep Falkon DevKit updated as Microsoft releases new official VS Code updates:

```bash
# Fetch and merge upstream release (e.g. 1.133.0 or latest)
npm run sync-upstream [tag]
```

### 3-Stage Release Branch Strategy
1. **`dev-updates`**: Isolated branch where upstream `microsoft/vscode` releases are fetched and compiled.
2. **`dev`**: Integration branch where Pull Requests from `dev-updates` undergo battle-testing.
3. **`main`**: Production-ready release branch.

👉 **For full release sync guidelines, see [UPSTREAM_SYNC.md](file:///C:/Users/vbox/Falkon_Dev_Kit/UPSTREAM_SYNC.md).**

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).  
*Visual Studio Code source code is Copyright (c) Microsoft Corporation.*
