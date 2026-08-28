# Falkon IDE & Code-OSS - Agent & Developer Rules

This document establishes the **MANDATORY ARCHITECTURAL RULES** for all AI coding agents, contributors, and developers working on the Falkon IDE open-source project.

---

## 🚨 MANDATORY RULE: Two-Layer Architectural Separation

Falkon IDE is built on top of Microsoft's Code-OSS (VS Code Web) and Tauri v2. To maintain 100% upstream Code-OSS compatibility and prevent codebase degradation, **ALL development must strictly adhere to the following layer isolation**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 1: Code-OSS Upstream Core                       │
│  • src/vs/**, extensions/** (Upstream Microsoft Code-OSS source tree)      │
│  • NEVER edit or pollute upstream VS Code source files directly.            │
│  • Upstream files must remain clean for seamless git pulls from upstream.   │
│  • Minimal integration hooks are applied ONLY via declarative text patches. │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼  (Bridge via IPC & Global Registry)
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 2: Falkon-IDE Native Layer                      │
│  • falkon/core/**   → Webview IPC shims, PTY terminal backend, sidecar      │
│  • falkon/build/**  → Synchronous esbuild bundler, Arch Linux packager      │
│  • falkon/patcher/**→ Declarative, idempotent upstream patch engine         │
│  • src-tauri/**     → Native Rust engine, commands, and security services   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📌 Strict Guidelines for Agents and Developers

### 1. DO NOT TOUCH VS CODE'S SOURCE FILES DIRECTLY
- **NEVER** edit files in `src/vs/**` or `extensions/**` directly for custom features.
- If an upstream hook is required (e.g. desktop flag flip, terminal backend registration, native dialog delegation), add an idempotent entry to [`falkon/patcher/patch-upstream.js`](falkon/patcher/patch-upstream.js).
- Patches must be 100% idempotent (always test `replNorm` before `findNorm`).

### 2. KEEP ALL FALKON LOGIC IN `falkon/` AND `src-tauri/`
- Frontend bridges: [`falkon/core/tauri-shim.js`](falkon/core/tauri-shim.js)
- Extension host sidecar server: [`falkon/core/ext-host-server.js`](falkon/core/ext-host-server.js)
- Terminal PTY integration: [`falkon/core/tauri-terminal.ts`](falkon/core/tauri-terminal.ts)
- Native backend: [`src-tauri/src/`](src-tauri/src/)

### 3. PACKAGING & BUILD INTEGRITY
- The build orchestrator [`falkon/build/run-tauri.js`](falkon/build/run-tauri.js) runs bundling **synchronously** before Tauri spawns.
- Tauri's `frontendDist` points to `dist/`. Redundant raw source trees (`src/vs`) or test bundles must never be copied into `dist/` to keep binary and package sizes minimal (~24–30 MB).
- Linux packaging must support Debian/Ubuntu (`.deb`), RedHat/Fedora (`.rpm`), and Arch Linux (`.pkg.tar.zst`).

---

## 🧪 Validation & Verification Steps

1. **Verify Patcher Idempotency**:
   ```bash
   node falkon/patcher/patch-upstream.js
   ```
2. **Compile Built-in Extensions**:
   ```bash
   node build/build-all-extensions.mjs
   ```
3. **Bundle VS Code Workbench**:
   ```bash
   node falkon/build/bundle-vscode.js
   ```
4. **Launch Dev Environment**:
   ```bash
   npm run dev
   ```
5. **Build Release & Arch Package**:
   ```bash
   npm run build:arch
   ```
