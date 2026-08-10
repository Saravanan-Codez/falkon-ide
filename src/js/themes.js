/**
 * Theme switching & VS Code Theme definitions for Falkon Dev Kit
 */
import { state } from './state.js';

export const themes = {
  'falkon-dark': {
    name: 'Falkon Neon (Default Dark)',
    monacoTheme: 'vs-dark',
    colors: {
      '--primary': '#8257e5',
      '--primary-hover': '#996dff',
      '--background': '#0b0c14',
      '--sidebar-bg': '#07080e',
      '--header-bg': '#0f111a',
      '--footer-bg': '#07080e',
      '--editor-bg': '#0b0c14',
      '--active-tab-bg': '#151828',
      '--inactive-tab-bg': '#090a10',
      '--text': '#f1f1f5',
      '--text-muted': '#6b7280',
      '--accent': '#00f0ff',
      '--border': '#1f2438'
    }
  },
  'vscode-dark': {
    name: 'VS Code Dark+',
    monacoTheme: 'vs-dark',
    colors: {
      '--primary': '#007acc',
      '--primary-hover': '#0098ff',
      '--background': '#1e1e1e',
      '--sidebar-bg': '#252526',
      '--header-bg': '#3c3c3c',
      '--footer-bg': '#007acc',
      '--editor-bg': '#1e1e1e',
      '--active-tab-bg': '#1e1e1e',
      '--inactive-tab-bg': '#2d2d2d',
      '--text': '#cccccc',
      '--text-muted': '#858585',
      '--accent': '#569cd6',
      '--border': '#333333'
    }
  },
  'monokai': {
    name: 'Monokai Pro',
    monacoTheme: 'vs-dark',
    colors: {
      '--primary': '#a6e22e',
      '--primary-hover': '#b7f33f',
      '--background': '#272822',
      '--sidebar-bg': '#1e1f1c',
      '--header-bg': '#1e1f1c',
      '--footer-bg': '#272822',
      '--editor-bg': '#272822',
      '--active-tab-bg': '#272822',
      '--inactive-tab-bg': '#1e1f1c',
      '--text': '#f8f8f2',
      '--text-muted': '#75715e',
      '--accent': '#f92672',
      '--border': '#3e3d32'
    }
  },
  'solarized-dark': {
    name: 'Solarized Dark',
    monacoTheme: 'vs-dark',
    colors: {
      '--primary': '#268bd2',
      '--primary-hover': '#3aa1e8',
      '--background': '#002b36',
      '--sidebar-bg': '#073642',
      '--header-bg': '#073642',
      '--footer-bg': '#073642',
      '--editor-bg': '#002b36',
      '--active-tab-bg': '#002b36',
      '--inactive-tab-bg': '#073642',
      '--text': '#839496',
      '--text-muted': '#586e75',
      '--accent': '#b58900',
      '--border': '#094352'
    }
  },
  'light-modern': {
    name: 'VS Code Light+',
    monacoTheme: 'vs',
    colors: {
      '--primary': '#0078d4',
      '--primary-hover': '#106ebe',
      '--background': '#ffffff',
      '--sidebar-bg': '#f3f3f3',
      '--header-bg': '#f3f3f3',
      '--footer-bg': '#007acc',
      '--editor-bg': '#ffffff',
      '--active-tab-bg': '#ffffff',
      '--inactive-tab-bg': '#ececec',
      '--text': '#333333',
      '--text-muted': '#6e6e6e',
      '--accent': '#0078d4',
      '--border': '#e5e5e5'
    }
  }
};

export function apply(themeId) {
  const theme = themes[themeId] || themes['falkon-dark'];
  state.themeId = themeId;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(theme.colors)) {
    root.style.setProperty(key, val);
  }
  if (window.monaco && theme.monacoTheme) {
    window.monaco.editor.setTheme(theme.monacoTheme);
  }
}

export function getCurrentTheme() {
  return state.themeId || 'falkon-dark';
}
