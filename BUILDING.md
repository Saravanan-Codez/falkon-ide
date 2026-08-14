# Building & Packaging Guide for Falkon IDE (VS Code in Tauri)

This document provides step-by-step instructions for building production installer binaries and standalone executables for **Windows**, **macOS**, and **Linux**.

---

## 📋 Prerequisites

Before building the production installers, ensure your build environment has the required dependencies installed for your operating system:

### 1. General Requirements (All Platforms)
- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher (`npm -v`)
- **Rust Toolchain**: Stable Rust toolchain (`rustc --version` & `cargo --version`). Install via [rustup.rs](https://rustup.rs/).

---

### 2. OS-Specific Build Dependencies

#### 🪟 Windows
- **C++ Build Tools**: Install **Visual Studio Build Tools** (Desktop development with C++ workload) or **Visual Studio Community**.
- **WiX Toolchain v3.11+** (for `.msi` installers) or **NSIS** (for `.exe` setup installers):
  - Installed automatically by Tauri, or manually via `choco install wix` / `winget install NSIS.NSIS`.
- **WebView2 Runtime**: Installed natively on Windows 10/11.

#### 🍎 macOS
- **Xcode Command Line Tools**: Run `xcode-select --install` in Terminal.

#### 🐧 Linux (Debian / Ubuntu / Fedora / Arch)
Install required system development packages and WebKitGTK:
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  javascriptcoregtk-4.1-dev \
  libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install -y \
  gcc \
  gcc-c++ \
  make \
  openssl-devel \
  gtk3-devel \
  webkit2gtk4.1-devel
```

---

## 🚀 Building the Production Installers

### Step 1: Install Dependencies
From the repository root:
```bash
npm install
```

### Step 2: Build Production Bundle & Installers
Execute the unified build command:
```bash
npm run build
```

This single command automatically:
1. **Bundles Built-in Extensions & Web Workbench**: Compiles 38+ built-in extensions with `esbuild` and bundles the VS Code workbench stylesheets and JavaScript into `src/dist/`.
2. **Compiles Rust Native Backend**: Compiles `src-tauri` in release mode (`cargo build --release`).
3. **Generates Native Installers**: Packages platform-specific installer bundles into `src-tauri/target/release/bundle/`.

---

## 📦 Output Installer Locations

After `npm run build` completes, your installers will be located in `src-tauri/target/release/bundle/`:

| Platform | Installer Format | Output Path |
| :--- | :--- | :--- |
| **Windows** | `.msi` Installer | `src-tauri/target/release/bundle/msi/Code - OSS_1.133.0_x64_en-US.msi` |
| **Windows** | `.exe` Setup (NSIS) | `src-tauri/target/release/bundle/nsis/Code - OSS_1.133.0_x64-setup.exe` |
| **macOS** | `.dmg` Disk Image | `src-tauri/target/release/bundle/dmg/Code - OSS_1.133.0_x64.dmg` |
| **macOS** | `.app` Bundle | `src-tauri/target/release/bundle/macos/Code - OSS.app` |
| **Linux** | `.AppImage` | `src-tauri/target/release/bundle/appimage/code-oss_1.133.0_amd64.AppImage` |
| **Linux** | `.deb` Package | `src-tauri/target/release/bundle/deb/code-oss_1.133.0_amd64.deb` |

---

## 🛠️ Fast Target-Specific Building (Skip Unneeded Installers)

To save build time, you can build **only the specific installer target you need** instead of packaging all formats:

### Dedicated Target NPM Shortcuts
```bash
# Windows Setup (.exe) installer via NSIS
npm run build:nsis

# Windows Installer (.msi) package via WiX
npm run build:msi

# macOS (.dmg) Disk Image
npm run build:dmg

# Linux (.deb) Debian / Ubuntu package
npm run build:deb

# Linux (.AppImage) Portable Binary
npm run build:appimage
```

### Passing Dynamic Bundle Flags
You can also pass any custom `--bundles` flag directly through `npm run build`:
```bash
# Build only NSIS setup EXE on Windows
npm run build -- --bundles nsis

# Build only MSI installer on Windows
npm run build -- --bundles msi

# Build only Deb package on Linux
npm run build -- --bundles deb
```

---

## 🌐 GitHub Actions CI/CD Multi-Platform Workflow

To automatically build production installers for Windows, macOS, and Linux on every release tag, use this sample `.github/workflows/build.yml`:

```yaml
name: Release Builds

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        platform: [ubuntu-latest, macos-latest, windows-latest]

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install Linux Dependencies
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt update
          sudo apt install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install npm dependencies
        run: npm install

      - name: Build Tauri App
        run: npm run build

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: installers-${{ matrix.platform }}
          path: src-tauri/target/release/bundle/
```

---

## 🔧 Troubleshooting Build Issues

1. **Windows Spectre Mitigation Error (`MSB8040`)**:
   - If `node-gyp` fails on native C++ dependencies, run PowerShell with:
     ```powershell
     $env:SpectreMitigation="false"
     $env:VSSKIPMSB8040="1"
     npm run build
     ```

2. **Linux WebKitGTK headers missing**:
   - Ensure `libwebkit2gtk-4.1-dev` and `javascriptcoregtk-4.1-dev` are installed.

3. **Node.js Child Process Security Warning (`DEP0190`)**:
   - `run-tauri.js` safely manages cross-platform process spawning for `npx.cmd` (Windows) and `npx` (Unix).
