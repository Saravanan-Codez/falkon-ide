/**
 * Run panel - Execute Cimple program with configurable args/history
 */
import { state } from './state.js';
import * as editor from './editor.js';
import * as workspace from './workspace.js';
import { safeParse } from './utils.js';

const { ipcRenderer } = require('electron');
const { join, dirname } = require('path');
const { tmpdir } = require('os');

const STORAGE_CONFIG = 'cimple.runConfig';
const STORAGE_HISTORY = 'cimple.runHistory';
const MAX_HISTORY = 10;

const runEntrySelect = document.getElementById('run-entry-select');
const runArgsInput = document.getElementById('run-args-input');
const runCwdInput = document.getElementById('run-cwd-input');
const runUseWorkspaceBtn = document.getElementById('run-use-workspace-btn');
const runBrowseEntry = document.getElementById('run-browse-entry');
const runBtn = document.getElementById('run-btn');
const runHistoryList = document.getElementById('run-history-list');
const runHistoryClear = document.getElementById('run-history-clear');
const runLastResultEl = document.getElementById('run-last-result');

function persistRunConfig() {
  try {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(state.runConfig));
  } catch {
    // ignore
  }
}

function persistHistory() {
  try {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(state.runHistory));
  } catch {
    // ignore
  }
}

function loadPersistedState() {
  const storedConfig = safeParse(localStorage.getItem(STORAGE_CONFIG));
  if (storedConfig && typeof storedConfig === 'object') {
    Object.assign(state.runConfig, storedConfig);
  }
  const storedHistory = safeParse(localStorage.getItem(STORAGE_HISTORY));
  if (Array.isArray(storedHistory)) {
    state.runHistory = storedHistory;
  }
}

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '';
  }
}

function renderEntryOptions() {
  if (!runEntrySelect) return;
  const opts = [];
  const seen = new Set();
  state.tabs.forEach(tab => {
    if (tab.path && !seen.has(tab.path)) {
      seen.add(tab.path);
      opts.push({ path: tab.path, label: tab.title });
    }
  });
  if (state.runConfig.entryPath && !seen.has(state.runConfig.entryPath)) {
    opts.push({ path: state.runConfig.entryPath, label: state.runConfig.entryPath.split(/[/\\]/).pop() || state.runConfig.entryPath });
  }
  runEntrySelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a file';
  runEntrySelect.appendChild(placeholder);
  opts.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.path;
    option.textContent = `${opt.label} (${opt.path})`;
    runEntrySelect.appendChild(option);
  });
  runEntrySelect.value = state.runConfig.entryPath || '';
}

function renderHistory() {
  if (!runHistoryList) return;
  runHistoryList.innerHTML = '';
  if (!state.runHistory.length) {
    runHistoryList.innerHTML = '<p class="run-history-empty">No runs yet.</p>';
    return;
  }
  state.runHistory.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'run-history-row';
    row.dataset.index = String(index);
    row.innerHTML = `
      <strong>${item.entry || 'Untitled'}</strong>
      <div class="run-history-meta">
        <span class="run-history-badge ${item.exitCode === 0 ? 'success' : 'error'}">${item.exitCode === 0 ? 'Success' : 'Exit ' + item.exitCode}</span>
        <span>${item.args || 'no args'}</span>
        <span>${formatTimestamp(item.timestamp)}</span>
      </div>
    `;
    row.addEventListener('click', () => {
      state.runConfig.entryPath = item.entry;
      state.runConfig.args = item.args;
      state.runConfig.cwd = item.cwd || '';
      state.runConfig.useWorkspaceCwd = item.cwd === workspace.getWorkspacePath();
      persistRunConfig();
      renderEntryOptions();
      updateFormFields();
    });
    runHistoryList.appendChild(row);
  });
}

function updateFormFields() {
  if (runArgsInput) runArgsInput.value = state.runConfig.args || '';
  if (runCwdInput) runCwdInput.value = state.runConfig.cwd || '';
  updateLastResult();
}

function updateLastResult(result = state.runConfig.lastResult) {
  if (!runLastResultEl) return;
  if (!result) {
    runLastResultEl.textContent = 'Awaiting run';
    return;
  }
  runLastResultEl.textContent = `${result.exitCode === 0 ? 'Success' : 'Exit ' + result.exitCode} @ ${formatTimestamp(result.timestamp)}`;
}

function parseArgs(value) {
  if (!value) return [];
  const tokens = value.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return tokens.map(token => token.replace(/^"|"$/g, ''));
}

function computeCwd() {
  if (state.runConfig.useWorkspaceCwd && state.workspacePath) {
    return state.workspacePath;
  }
  if (state.runConfig.cwd) {
    return state.runConfig.cwd;
  }
  const possibleEntry = state.runConfig.entryPath || editor.getActiveTab()?.path;
  if (possibleEntry) {
    return dirname(possibleEntry);
  }
  return state.workspacePath || process.cwd();
}

async function writeTempFile(content) {
  const { writeFile, unlink } = require('fs').promises;
  const tmpPath = join(tmpdir(), `cimple_run_${Date.now()}.cimple`);
  await writeFile(tmpPath, content || '', 'utf8');
  return {
    path: tmpPath,
    cleanup: async () => { await unlink(tmpPath).catch(() => {}); }
  };
}

function focusOutputTab() {
  const panelTabs = document.getElementById('panel-tabs');
  if (panelTabs) {
    panelTabs.querySelectorAll('.panel-tab').forEach(tab => tab.classList.remove('active'));
    const outputTab = panelTabs.querySelector('.panel-tab[data-tab="output"]');
    if (outputTab) outputTab.classList.add('active');
  }
  document.querySelectorAll('.panel-view').forEach(v => v.classList.remove('active'));
  const outView = document.getElementById('panel-output');
  if (outView) outView.classList.add('active');
}

function appendRunOutput(data) {
  const output = document.getElementById('output-log') || document.getElementById('run-output');
  if (!output) return;
  if (output.textContent === '') output.textContent = '';
  output.textContent += data;
  output.scrollTop = output.scrollHeight;
}

async function runCurrent() {
  focusOutputTab();
  const output = document.getElementById('output-log');
  if (output) output.textContent = 'Running...\n';
  const args = parseArgs(state.runConfig.args || '');
  const cwd = computeCwd();
  let runtimeEntry = state.runConfig.entryPath;
  let cleanupFn = null;
  if (!runtimeEntry) {
    const activeTab = editor.getActiveTab();
    if (activeTab?.path) {
      runtimeEntry = activeTab.path;
    } else if (activeTab?.content) {
      const temp = await writeTempFile(activeTab.content);
      runtimeEntry = temp.path;
      cleanupFn = temp.cleanup;
    }
  }
  if (!runtimeEntry) {
    appendRunOutput('No entry file selected\n');
    return;
  }

  try {
    const result = await ipcRenderer.invoke('run-cimple', runtimeEntry, { args, cwd });
    const historyRecord = {
      entry: runtimeEntry,
      args: state.runConfig.args || '',
      cwd,
      exitCode: result.code,
      timestamp: Date.now(),
    };
    state.runConfig.lastResult = historyRecord;
    addHistory(historyRecord);
    persistRunConfig();
    renderHistory();
    updateLastResult();
  } catch (err) {
    appendRunOutput('\n' + String(err));
  } finally {
    if (cleanupFn) await cleanupFn();
  }
}

function addHistory(record) {
  state.runHistory = [record, ...state.runHistory].slice(0, MAX_HISTORY);
  persistHistory();
}

export function init() {
  loadPersistedState();
  renderEntryOptions();
  renderHistory();
  updateFormFields();
  updateLastResult();

  ipcRenderer.on('run-output', (_, data) => appendRunOutput(data));

  runEntrySelect?.addEventListener('change', (e) => {
    state.runConfig.entryPath = e.target.value;
    persistRunConfig();
  });
  runArgsInput?.addEventListener('input', () => {
    state.runConfig.args = runArgsInput.value;
    persistRunConfig();
  });
  runCwdInput?.addEventListener('input', () => {
    state.runConfig.cwd = runCwdInput.value;
    state.runConfig.useWorkspaceCwd = false;
    persistRunConfig();
  });
  runUseWorkspaceBtn?.addEventListener('click', () => {
    if (!state.workspacePath) return;
    state.runConfig.cwd = state.workspacePath;
    state.runConfig.useWorkspaceCwd = true;
    persistRunConfig();
    updateFormFields();
  });
  runBrowseEntry?.addEventListener('click', async () => {
    const selected = await ipcRenderer.invoke('open-file');
    if (selected) {
      state.runConfig.entryPath = selected;
      persistRunConfig();
      renderEntryOptions();
      updateFormFields();
    }
  });
  runBtn?.addEventListener('click', runCurrent);
  runHistoryClear?.addEventListener('click', () => {
    state.runHistory = [];
    persistHistory();
    renderHistory();
  });

  document.addEventListener('tabs-changed', renderEntryOptions);
  document.addEventListener('tab-switched', renderEntryOptions);
  workspace.onWorkspaceChange(() => {
    if (state.runConfig.useWorkspaceCwd && state.workspacePath) {
      state.runConfig.cwd = state.workspacePath;
      persistRunConfig();
      updateFormFields();
    }
  });
}
