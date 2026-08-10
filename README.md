# Falkon Dev Kit 🚀

**Falkon Dev Kit (FDK)** is a high-performance, lightweight IDE built with **Tauri v2** and **Monaco Editor**, surgically incorporating core workbench features from VS Code.

## Features

- **Tauri v2 Powered**: Near-instant startup times and minimal RAM usage compared to traditional Electron apps.
- **Monaco Code Editor**: Full-featured code editor with syntax highlighting, auto-completion, multi-cursor, minimap, sticky scroll, and auto-closing brackets.
- **Falkon Language Support**: Custom syntax highlighting, snippets, and tokenizers for Falkon code (`.falkon`, `.flk`).
- **VS Code Theme Engine**: Curated selection of themes including *Falkon Neon*, *VS Code Dark+*, *Monokai Pro*, *Solarized Dark*, and *VS Code Light+*.
- **Command Palette (`Ctrl+Shift+P`)**: Fast command search and keyboard shortcuts.
- **Integrated Terminal & Toolchain Runner**: Execute Falkon scripts and system commands directly from the IDE.
- **Git Integration**: Live branch display, repo status tracking, and file decorations.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/) (v1.75 or higher)
- C++ Build Tools (Visual Studio Build Tools on Windows)

### Development

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

### Running Unit Tests

```bash
npm run test
```

### Building for Production

Build the standalone desktop executable and installers:

```bash
npm run build
```

## Project Structure

```
Falkon_Dev_kit/
├── src/                # Web Frontend (HTML, CSS, Monaco JS modules)
│   ├── js/
│   │   ├── app.js      # Main UI application entry
│   │   ├── editor.js   # Monaco editor manager
│   │   ├── falkon-lang.js # Falkon language definition & snippets
│   │   ├── themes.js   # VS Code theme definitions
│   │   └── tauri-shim.js # Tauri IPC bridge
│   └── style.css       # Design system & dark mode tokens
├── src-tauri/          # Rust Backend (Tauri v2 application)
│   ├── src/main.rs     # Native system IPC handlers
│   ├── tauri.conf.json # Tauri configuration & window settings
│   └── Cargo.toml      # Rust dependencies
└── tests/              # Automated unit tests
```

## License

MIT License
