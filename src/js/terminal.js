/**
 * Integrated Terminal styled like VS Code
 */
import * as fileExplorer from './file-explorer.js';
import * as workspace from './workspace.js';
import { escapeHtml, generateId } from './utils.js';

const { invoke, on, process } = window.electronAPI;

const DEFAULT_SHELL = process.platform === 'win32'
  ? (process.env.POWERSHELL || process.env.COMSPEC || 'powershell.exe')
  : (process.env.SHELL || 'bash');
const isPowerShell = /powershell|pwsh/i.test(DEFAULT_SHELL);
const isCmd = /cmd\.exe$/i.test(DEFAULT_SHELL);
const SHELL_ARGS = isPowerShell ? ['-NoLogo', '-NoExit'] : (isCmd ? ['/K'] : []);
const SHELL_DISPLAY = DEFAULT_SHELL.split(/[\\/]/).pop() || DEFAULT_SHELL;

const MAX_OUTPUT = 50000;
const HISTORY_LIMIT = 120;

const tabStrip = document.getElementById('terminal-tab-strip');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');
const terminalHint = document.getElementById('terminal-input-hint');
const terminalClearBtn = document.getElementById('terminal-clear-btn');
const terminalKillBtn = document.getElementById('terminal-kill-btn');
const terminalRestartBtn = document.getElementById('terminal-restart-btn');
const terminalNewBtn = document.getElementById('terminal-new-btn');
const terminalSplitBtn = document.getElementById('terminal-split-btn');

const sessions = new Map();
let activeSessionId = null;

function getDefaultCwd() {
  return workspace.getWorkspacePath() || '.';
}


function setOutput(text) {
  if (!terminalOutput) return;
  terminalOutput.textContent = text;
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function renderTabs() {
  if (!tabStrip) return;
  tabStrip.innerHTML = '';
  for (const session of sessions.values()) {
    const tab = document.createElement('div');
    tab.className = 'terminal-tab' + (session.id === activeSessionId ? ' active' : '');
    tab.dataset.sessionId = session.id;
    tab.innerHTML = `
      <span class="terminal-tab-title">${escapeHtml(session.title)}</span>
      <span class="terminal-tab-status">${escapeHtml(session.status)}</span>
      <button class="terminal-tab-close" aria-label="Close terminal tab">×</button>
    `;
    tab.addEventListener('click', () => selectSession(session.id));
    tab.querySelector('.terminal-tab-close')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeSession(session.id);
    });
    tabStrip.appendChild(tab);
  }
  const add = document.createElement('button');
  add.className = 'terminal-tab terminal-tab-add';
  add.textContent = '+';
  add.addEventListener('click', () => createSession());
  tabStrip.appendChild(add);
}

function selectSession(id) {
  if (!sessions.has(id)) return;
  activeSessionId = id;
  const session = sessions.get(id);
  setOutput(session.output);
  terminalInput.value = '';
  updateHint(session, '');
  renderTabs();
  requestAnimationFrame(() => terminalInput?.focus());
}

function closeSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  invoke('terminal-kill', { sessionId: id });
  sessions.delete(id);
  if (activeSessionId === id) {
    const remaining = Array.from(sessions.keys());
    activeSessionId = remaining.length ? remaining[remaining.length - 1] : null;
  }
  renderTabs();
  if (activeSessionId) selectSession(activeSessionId);
  else setOutput('');
}

function updateHint(session, prefix) {
  if (!terminalHint || !session) return;
  if (!prefix) {
    terminalHint.textContent = '';
    return;
  }
  const match = session.history.slice().reverse().find(entry => entry.toLowerCase().startsWith(prefix.toLowerCase()) && entry !== prefix);
  terminalHint.textContent = match ? match.slice(prefix.length) : '';
}

function navigateHistory(session, delta) {
  if (!terminalInput || !session || !session.history.length) return;
  if (session.historyIndex == null) session.historyIndex = session.history.length;
  session.historyIndex = Math.min(Math.max(0, session.historyIndex + delta), session.history.length);
  if (session.historyIndex === session.history.length) {
    terminalInput.value = '';
  } else {
    terminalInput.value = session.history[session.historyIndex];
  }
  updateHint(session, terminalInput.value);
}

function pushHistory(session, command) {
  if (!session || !command) return;
  const trimmed = command.trim();
  if (!trimmed) return;
  if (session.history[session.history.length - 1] !== trimmed) {
    session.history.push(trimmed);
    if (session.history.length > HISTORY_LIMIT) session.history.shift();
  }
  session.historyIndex = session.history.length;
}

async function spawnSession(session) {
  session.status = 'Starting';
  session.output = '';
  session.historyIndex = session.history.length;
  renderTabs();
  try {
    await invoke('terminal-spawn', { sessionId: session.id, cwd: session.cwd, shell: DEFAULT_SHELL, args: SHELL_ARGS });
    session.status = 'Running';
  } catch (err) {
    session.status = 'Error';
    session.output += `\nFailed to start: ${err.message}\n`;
  }
  renderTabs();
  if (activeSessionId === session.id) setOutput(session.output);
}

function createSession(options = {}) {
  const id = generateId('term');
  const cwd = options.cwd || getDefaultCwd();
  const session = {
    id,
    title: SHELL_DISPLAY,
    status: 'Starting',
    cwd,
    output: '',
    history: [],
    historyIndex: 0,
  };
  sessions.set(id, session);
  activeSessionId = id;
  selectSession(id);
  spawnSession(session);
  return session;
}

function handleOutput(sessionId, chunk) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.output = (session.output + chunk).slice(-MAX_OUTPUT);
  if (activeSessionId === sessionId) setOutput(session.output);
}

function handleExit(sessionId, code) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.status = code === 0 ? 'Exited' : `Exit ${code}`;
  renderTabs();
}

function getActiveSession() {
  return activeSessionId ? sessions.get(activeSessionId) : null;
}

function clearSessionOutput() {
  const session = getActiveSession();
  if (!session) return;
  session.output = '';
  if (activeSessionId) setOutput('');
}

function killActiveSession() {
  const session = getActiveSession();
  if (!session) return;
  invoke('terminal-kill', { sessionId: session.id });
  session.status = 'Killed';
  renderTabs();
}

function restartActiveSession() {
  const session = getActiveSession();
  if (!session) return;
  invoke('terminal-kill', { sessionId: session.id }).finally(() => {
    session.output = '';
    session.status = 'Restarting';
    renderTabs();
    spawnSession(session);
  });
}

function splitActiveSession() {
  const session = getActiveSession();
  if (!session) return;
  createSession({ cwd: session.cwd });
}

function sendCommand(command) {
  const session = getActiveSession();
  if (!session) return;
  pushHistory(session, command);
  updateHint(session, '');
  invoke('terminal-write', { sessionId: session.id, command: command + '\n' });
}

function sendSigint() {
  const session = getActiveSession();
  if (!session) return;
  invoke('terminal-sigint', { sessionId: session.id });
}

export function init() {
  on('terminal-data', (_, payload) => {
    if (payload?.sessionId && payload.data) {
      handleOutput(payload.sessionId, payload.data);
    }
  });

  on('terminal-exit', (_, payload) => {
    if (payload?.sessionId) {
      handleExit(payload.sessionId, payload.code);
    }
  });

  renderTabs();
  if (!sessions.size) createSession();

  terminalInput?.addEventListener('input', () => {
    const session = getActiveSession();
    updateHint(session, terminalInput.value);
  });

  terminalInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const text = terminalInput.value;
      if (text.trim().length === 0) {
        sendCommand('');
        terminalInput.value = '';
        return;
      }
      sendCommand(text);
      terminalInput.value = '';
    }
    if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      clearSessionOutput();
    }
    if (event.key === 'c' && event.ctrlKey) {
      event.preventDefault();
      sendSigint();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateHistory(getActiveSession(), -1);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateHistory(getActiveSession(), 1);
    }
  });

  terminalClearBtn?.addEventListener('click', clearSessionOutput);
  terminalKillBtn?.addEventListener('click', killActiveSession);
  terminalRestartBtn?.addEventListener('click', restartActiveSession);
  terminalSplitBtn?.addEventListener('click', splitActiveSession);
  terminalNewBtn?.addEventListener('click', () => createSession());

  // events already wired above
}
