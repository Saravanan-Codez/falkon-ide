/**
 * VS Code Keybindings Registry for Falkon Dev Kit
 */
import { state } from './state.js';
import * as editor from './editor.js';
import * as fileExplorer from './file-explorer.js';
import * as commandPalette from './command-palette.js';
import * as zenMode from './zen-mode.js';
import { showFindWidget } from './find.js';

export function initKeybindings() {
  document.addEventListener('keydown', (e) => {
    // Check if input/textarea has focus (unless pressing palette or global shortcuts)
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    // Ctrl+Shift+P: Command Palette
    if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      commandPalette.show();
      return;
    }

    // Ctrl+P: Quick Open Files
    if (e.ctrlKey && !e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      commandPalette.showQuickOpen();
      return;
    }

    // Ctrl+B: Toggle Sidebar
    if (e.ctrlKey && !e.shiftKey && (e.key === 'B' || e.key === 'b')) {
      e.preventDefault();
      document.getElementById('toggle-sidebar-btn')?.click();
      return;
    }

    // Ctrl+`: Toggle Terminal Panel
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      const panel = document.getElementById('bottom-panel');
      if (panel) {
        state.panelVisible = !state.panelVisible;
        panel.classList.toggle('hidden', !state.panelVisible);
      }
      return;
    }

    // Ctrl+Shift+F: Global Search
    if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      document.querySelector('.activity-item[data-view="search"]')?.click();
      document.getElementById('find-input')?.focus();
      return;
    }

    // Ctrl+Shift+E: Explorer View
    if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      document.querySelector('.activity-item[data-view="explorer"]')?.click();
      return;
    }

    // Ctrl+Shift+R: Run Falkon Code
    if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      e.preventDefault();
      document.getElementById('run-btn')?.click();
      return;
    }

    // Ctrl+S: Save File
    if (e.ctrlKey && !e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      const tab = editor.getActiveTab();
      if (tab?.path) {
        fileExplorer.saveFile(tab);
      } else if (tab) {
        fileExplorer.saveFileAs(tab);
      }
      return;
    }

    // Ctrl+W: Close Tab
    if (e.ctrlKey && !e.shiftKey && (e.key === 'W' || e.key === 'w')) {
      e.preventDefault();
      if (state.activeTabId) {
        editor.closeTab(state.activeTabId);
      }
      return;
    }

    // Ctrl+N: New File
    if (e.ctrlKey && !e.shiftKey && (e.key === 'N' || e.key === 'n') && !isInputFocused) {
      e.preventDefault();
      editor.addTab();
      return;
    }

    // Ctrl+F: Find in Current File
    if (e.ctrlKey && !e.shiftKey && (e.key === 'F' || e.key === 'f') && !isInputFocused) {
      e.preventDefault();
      showFindWidget();
      return;
    }
  });
}
