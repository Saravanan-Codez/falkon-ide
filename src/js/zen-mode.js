/**
 * Zen Mode - Ctrl+K Z
 */
import { state } from './state.js';

export function toggle() {
  state.zenMode = !state.zenMode;
  const activityBar = document.querySelector('.activity-bar');
  const sidebar = document.getElementById('primary-sidebar');
  const footer = document.querySelector('.editor-footer');
  const panel = document.getElementById('bottom-panel');
  const resizer = document.getElementById('sidebar-resizer');
  if (state.zenMode) {
    activityBar?.classList.add('hidden');
    sidebar?.classList.add('hidden');
    footer?.classList.add('hidden');
    panel?.classList.add('hidden');
    resizer?.classList.add('hidden');
  }
  else {
    activityBar?.classList.remove('hidden');
    activityBar?.classList.remove('hidden');
    sidebar?.classList.remove('hidden');
    footer?.classList.remove('hidden');
    panel?.classList.remove('hidden');
    resizer?.classList.remove('hidden');
  }
}
