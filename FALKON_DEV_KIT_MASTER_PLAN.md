# Master Architecture & Implementation Plan: Falkon Dev Kit (Full Desktop VS Code on Tauri + Node Extension Host)

---

## 1. Architecture: Hybrid Tauri Core + Node.js Extension Host Sidecar

To remove all "web restrictions" and enable 100% of VS Code desktop extensions, language servers, debuggers, and terminal capabilities, Falkon Dev Kit adopts the standard hybrid architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri Frontend (UI)                             │
│                  VS Code Workbench + Monaco Editor                     │
│               (~60-80 MB RAM, Instant Startup & GPU)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (WebSocket / Local Socket)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Tauri v2 (Rust Core Subsystem)                     │
│           Manages Window, PTY Terminal, FS, Dialogs, Sidecars          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Spawns & Supervises
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Node.js Sidecar (Extension Host)                     │
│                  `out/vs/workbench/api/node/extHost`                   │
│                                                                        │
│ • Runs ALL VS Code Desktop Extensions (Python, C++, ESLint, etc.)     │
│ • Spawns Language Server Protocol (LSP) subprocesses                   │
│ • Spawns Debug Adapter Protocol (DAP) debuggers                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Capabilities Unlocked

1. **100% Desktop Extension Compatibility**:
   - Python, C/C++, Rust Analyzer, Go, ESLint, Prettier, GitLens, Docker, Jupyter Notebooks.
   - Language Server Protocol (LSP) subprocesses run unrestricted.
2. **True Native Terminal**:
   - Spawns interactive shells with full TTY control.
3. **Seamless File System & Dialogs**:
   - Full OS disk access without browser sandboxing.
4. **Dual Marketplace**:
   - Direct access to Open VSX and Microsoft Marketplace.
