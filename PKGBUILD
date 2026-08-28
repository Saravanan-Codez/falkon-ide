# Maintainer: Falkon Labs <contact@falkon.dev>
pkgname=falkon-ide
pkgver=1.136.0
pkgrel=1
pkgdesc="Falkon IDE - Fast, lightweight desktop IDE powered by VS Code Web and Tauri"
arch=('x86_64' 'aarch64')
url="https://github.com/falkon-labs/falkon-ide"
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3' 'libsoup3' 'openssl' 'git')
makedepends=('rust' 'cargo' 'nodejs' 'npm' 'pkgconf')

build() {
    cd "${srcdir}/.."
    node falkon/build/bundle-vscode.js
    cargo build --release --manifest-path src-tauri/Cargo.toml
}

package() {
    cd "${srcdir}/.."
    install -Dm755 "src-tauri/target/release/falkon_ide" "${pkgdir}/usr/bin/falkon-ide"
    install -Dm644 "src-tauri/icons/32x32.png" "${pkgdir}/usr/share/icons/hicolor/32x32/apps/falkon-ide.png"
    install -Dm644 "src-tauri/icons/64x64.png" "${pkgdir}/usr/share/icons/hicolor/64x64/apps/falkon-ide.png"
    install -Dm644 "src-tauri/icons/128x128.png" "${pkgdir}/usr/share/icons/hicolor/128x128/apps/falkon-ide.png"
    install -Dm644 "src-tauri/icons/128x128@2x.png" "${pkgdir}/usr/share/icons/hicolor/256x256/apps/falkon-ide.png"
    
    cat <<EOF | install -Dm644 /dev/stdin "${pkgdir}/usr/share/applications/falkon-ide.desktop"
[Desktop Entry]
Name=Falkon IDE
Comment=Falkon IDE - Fast, lightweight desktop IDE powered by VS Code Web and Tauri
Exec=falkon-ide %F
Icon=falkon-ide
Type=Application
StartupNotify=true
StartupWMClass=falkon-ide
Categories=Development;IDE;TextEditor;
MimeType=text/plain;inode/directory;
EOF
}
