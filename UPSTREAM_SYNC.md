# Battle-Tested Upstream & Release Update Strategy

This document details the two update cycles for Falkon DevKit:
1. **Upstream Sync Cycle:** Incorporating new releases from `microsoft/vscode`.
2. **End-User In-App Auto-Update Cycle:** Delivering native desktop app updates to installed users.

---

## 1. Upstream VS Code Update Cycle (`microsoft/vscode` -> Falkon DevKit)

### 🛡️ Why This Strategy is Battle-Proof
- **Isolated Sandbox Branch (`dev-updates`):** Upstream merges occur strictly in `dev-updates`. Broken commits or upstream breaking changes **never** reach your active development code (`dev`) or production releases (`main`).
- **Decoupled Tauri IPC Layer:** Our Tauri bridges ([bundle-vscode-tauri.js](file:///C:/Users/vbox/Falkon_Dev_Kit/bundle-vscode-tauri.js), [src/js/tauri-shim.js](file:///C:/Users/vbox/Falkon_Dev_Kit/src/js/tauri-shim.js), [src-tauri/](file:///C:/Users/vbox/Falkon_Dev_Kit/src-tauri/)) run on top of VS Code's web workbench API contracts. Upstream updates to core editors or workbench components do not wipe out Tauri IPC bridges.
- **Automated Guarding & Validation:** `npm run sync-upstream` guards against dirty working trees, auto-stashes local edits, merges upstream tags, rebuilds extensions/workbench bundles, and verifies Rust native backend compilation automatically.

### 📋 Upstream Sync Execution
```bash
# Sync latest upstream main or specific release tag (e.g. 1.133.0)
npm run sync-upstream [tag]
```

### 🚦 Promotion Workflow
```
  upstream/main (microsoft/vscode)
         │
         ▼ (npm run sync-upstream)
    dev-updates (Isolated Sandbox & Automated Verification)
         │
         ▼ (Pull Request)
       dev      (Battle-Testing Environment)
         │
         ▼ (Verified Promotion)
      main      (Production Stable Release)
```

---

## 2. End-User In-App Auto-Update Cycle (App -> End Users)

Falkon DevKit supports native in-app auto-updates for installed end-users via **Tauri v2 Plugin Updater** (`@tauri-apps/plugin-updater`).

### 📦 How End-User Auto-Updating Works
1. **GitHub Releases Integration:** Every build uploaded to GitHub Releases generates a signed installer (`.msi` / `.exe` / `.dmg` / `.AppImage`) and signature file (`.sig`).
2. **Release Manifest (`latest.json`):** GitHub Releases hosts `latest.json` containing version numbers, release notes, download links, and cryptographic signatures.
3. **Native Background Check:** When users launch Falkon DevKit, Tauri checks `latest.json`. If a new version is available, it prompts the user, downloads the update delta in the background, and seamlessly applies the update on restart.

---

## 🛠️ Validation Checklist
Before merging `dev-updates` -> `dev`:
- [ ] `npm run bundle-vs` builds cleanly without ESBuild errors.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` returns zero Rust errors.
- [ ] `npm run dev` launches and connects to Node.js sidecar server.
- [ ] `File -> Open Folder...` opens native OS file manager.
- [ ] Titlebar Minimize, Maximize/Restore, and Close buttons function.
