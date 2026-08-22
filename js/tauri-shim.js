/**
 * Tauri v2 IPC bridge for VS Code Web Workbench.
 *
 * This script runs BEFORE the VS Code workbench initializes.
 * It:
 *  1. Registers a full IFileSystemProvider for file:// URIs via Tauri IPC
 *  2. Provides native file dialogs via Tauri IPC
 *  3. Bridges the terminal, search, and git IPC channels
 *  4. Exposes window.__vscode_tauri_bridge__ for the workbench init script
 */

let _hasWarnedNoTauri = false;
const invoke = (cmd, args) => {
  const win = window;
  if (win.__TAURI__?.core?.invoke) return win.__TAURI__.core.invoke(cmd, args);
  if (win.__TAURI_INTERNALS__?.invoke) return win.__TAURI_INTERNALS__.invoke(cmd, args);
  if (win.__TAURI_INVOKE__) return win.__TAURI_INVOKE__(cmd, args);
  if (!_hasWarnedNoTauri) {
    _hasWarnedNoTauri = true;
    console.info('[Tauri Shim] Running in browser environment (Tauri IPC native bridge inactive).');
  }
  return Promise.resolve(null);
};

// ─────────────────────────────────────────────
//  File System Provider API (exposed to workbench init)
// ─────────────────────────────────────────────

window.__tauri_fs__ = {
  readFile: (path) => invoke('read_file', { filePath: path }),
  readFileBytes: (path) => invoke('read_file_bytes', { filePath: path }),
  writeFile: (path, content) => invoke('write_file', { filePath: path, content }),
  writeFileBytes: (path, bytes) => invoke('write_file_bytes', { filePath: path, bytes: Array.from(bytes) }),
  copy: (source, target) => invoke('copy_file', { source, target }),
  readDir: (path) => invoke('read_dir', { dirPath: path }),
  stat: (path) => invoke('stat_file', { filePath: path }),
  exists: (path) => invoke('file_exists', { filePath: path }),
  mkdir: (path) => invoke('create_dir', { dirPath: path }),
  rename: (oldPath, newPath) => invoke('rename_file', { oldPath, newPath }),
  delete: (path) => invoke('delete_file', { filePath: path }),
};

// ─────────────────────────────────────────────
//  Native File Dialogs
// ─────────────────────────────────────────────

window.__tauri_dialogs__ = {
  openFolder: () => invoke('open_folder_dialog', {}),
  openFile: (filters) => invoke('open_file_dialog', { filters: filters ?? [] }),
  saveFile: (defaultName) => invoke('save_file_dialog', { defaultName: defaultName ?? null }),
};

// ─────────────────────────────────────────────
//  Terminal (PTY)
// ─────────────────────────────────────────────

const listen = (event, handler) => {
  const win = window;
  if (win.__TAURI__?.event?.listen) {
    return win.__TAURI__.event.listen(event, handler);
  }
  if (win.__TAURI_INTERNALS__?.transformCallback && win.__TAURI_INTERNALS__?.invoke) {
    const cbId = win.__TAURI_INTERNALS__.transformCallback((e) => handler(e));
    return win.__TAURI_INTERNALS__.invoke('plugin:event|listen', {
      event,
      target: { kind: 'Any' },
      handler: cbId
    });
  }
  return Promise.resolve(() => {});
};

window.__tauri_terminal__ = {
  create: (cwd, cols, rows) => {
    let cleanCwd = typeof cwd === 'string' ? cwd : null;
    if (cleanCwd && cleanCwd.startsWith('file://')) {
      cleanCwd = cleanCwd.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '');
    }
    return invoke('terminal_create', {
      cwd: cleanCwd,
      cols: (typeof cols === 'number' && cols > 0) ? cols : 80,
      rows: (typeof rows === 'number' && rows > 0) ? rows : 24
    });
  },
  write: (id, data) => {
    if (!id || data === undefined || data === null) return;
    invoke('terminal_write', { id, data: String(data) });
  },
  resize: (id, cols, rows) => invoke('terminal_resize', {
    id,
    cols: (typeof cols === 'number') ? cols : 80,
    rows: (typeof rows === 'number') ? rows : 24
  }),
  kill: (id) => invoke('terminal_kill', { id }),
  onData: (id, cb) => {
    const unlistenPromise = listen(`terminal-data-${id}`, (e) => {
      let str = '';
      if (typeof e === 'string') {
        str = e;
      } else if (e && typeof e.payload === 'string') {
        str = e.payload;
      } else if (e && e.payload !== undefined && e.payload !== null) {
        str = String(e.payload);
      } else if (e !== undefined && e !== null) {
        str = String(e);
      }
      if (str && typeof cb === 'function') {
        cb(str);
      }
    });
    return () => {
      unlistenPromise.then(u => typeof u === 'function' && u());
    };
  },
  onExit: (id, cb) => {
    const unlistenPromise = listen(`terminal-exit-${id}`, () => {
      if (typeof cb === 'function') cb();
    });
    return () => {
      unlistenPromise.then(u => typeof u === 'function' && u());
    };
  },
};

// ─────────────────────────────────────────────
//  Search
// ─────────────────────────────────────────────

window.__tauri_search__ = {
  searchText: (workspace, pattern, opts) => invoke('search_text', {
    workspace, pattern,
    include: opts?.include ?? null,
    exclude: opts?.exclude ?? null,
    caseSensitive: opts?.caseSensitive ?? false,
    maxResults: opts?.maxResults ?? 500,
  }),
  searchFiles: (workspace, pattern) => invoke('search_files', { workspace, pattern }),
};

// ─────────────────────────────────────────────
//  Git SCM
// ─────────────────────────────────────────────

window.__tauri_git__ = {
  branch: (cwd) => invoke('git_branch', { cwd: cwd ?? null }),
  status: (cwd) => invoke('git_status', { cwd: cwd ?? null }),
  isRepo: (cwd) => invoke('git_is_repo', { cwd: cwd ?? null }),
  log: (cwd, max) => invoke('git_log', { cwd, max: max ?? 50 }),
  diff: (cwd, staged) => invoke('git_diff', { cwd, staged: staged ?? false }),
  stage: (cwd, path) => invoke('git_stage', { cwd, path }),
  unstage: (cwd, path) => invoke('git_unstage', { cwd, path }),
  commit: (cwd, message) => invoke('git_commit', { cwd, message }),
  push: (cwd) => invoke('git_push', { cwd }),
  pull: (cwd) => invoke('git_pull', { cwd }),
  checkout: (cwd, branch, create) => invoke('git_checkout', { cwd, branch, create: create ?? false }),
};

// ─────────────────────────────────────────────
//  Settings persistence
// ─────────────────────────────────────────────

window.__tauri_settings__ = {
  read: () => invoke('read_settings', {}),
  write: (content) => invoke('write_settings', { content }),
  readKeybindings: () => invoke('read_keybindings', {}),
};

// ─────────────────────────────────────────────
//  Window Controls
// ─────────────────────────────────────────────

window.__tauri_window__ = {
  minimize: () => invoke('window_minimize', {}),
  toggleMaximize: () => invoke('window_toggle_maximize', {}),
  close: () => invoke('window_close', {}),
};

// ─────────────────────────────────────────────
//  Legacy electronAPI shim (for any remaining calls)
// ─────────────────────────────────────────────

window.electronAPI = {
  invoke: async (channel, ...args) => {
    switch (channel) {
      case 'read-file': return window.__tauri_fs__.readFile(args[0]);
      case 'write-file':
      case 'save-file': return window.__tauri_fs__.writeFile(args[0], args[1]);
      case 'read-dir': return window.__tauri_fs__.readDir(args[0]);
      case 'stat-file': return window.__tauri_fs__.stat(args[0]);
      case 'file-exists': return window.__tauri_fs__.exists(args[0]);
      case 'create-dir':
      case 'create-folder': return window.__tauri_fs__.mkdir(args[0]);
      case 'rename-file': return window.__tauri_fs__.rename(args[0], args[1]);
      case 'delete-file': return window.__tauri_fs__.delete(args[0]);
      case 'open-folder': return window.__tauri_dialogs__.openFolder();
      case 'open-file': return window.__tauri_dialogs__.openFile(args[0]);
      case 'save-file-dialog': return window.__tauri_dialogs__.saveFile(args[0]);
      case 'git-branch': return window.__tauri_git__.branch(args[0]);
      case 'git-status': return window.__tauri_git__.status(args[0]);
      case 'git-is-repo': return window.__tauri_git__.isRepo(args[0]);
      case 'run-falkon':
      case 'run-cimple': return invoke('run_falkon', { entry: args[0] || '', options: args[1] || {} });
      default:
        console.warn(`[electronAPI] Unknown channel: ${channel}`);
        return null;
    }
  },
  on: () => () => {},
  process: { platform: navigator.platform || 'Win32', env: {} }
};

console.log('[Tauri Shim] All IPC bridges registered:', {
  fs: !!window.__tauri_fs__,
  dialogs: !!window.__tauri_dialogs__,
  terminal: !!window.__tauri_terminal__,
  search: !!window.__tauri_search__,
  git: !!window.__tauri_git__,
  settings: !!window.__tauri_settings__,
});

// ─────────────────────────────────────────────
//  Desktop App Event Behaviors
// ─────────────────────────────────────────────

// Prevent browser navigation when files are dropped onto the app
window.addEventListener('dragover', (e) => e.preventDefault(), false);
window.addEventListener('drop', (e) => {
  const tag = e.target?.tagName?.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') {
    e.preventDefault();
  }
}, false);

// ─────────────────────────────────────────────
//  Marketplace CORS Bypass - fetch + XHR
//  VS Code's extension gallery uses XMLHttpRequest,
//  NOT window.fetch, so we must intercept both.
// ─────────────────────────────────────────────

function isMarketplaceUrl(url) {
  return typeof url === 'string' && (
    url.includes('marketplace.visualstudio.com') ||
    url.includes('open-vsx.org')
  );
}

function parseHeaders(headersInput) {
  const result = {};
  if (!headersInput) return result;
  if (typeof Headers !== 'undefined' && headersInput instanceof Headers) {
    headersInput.forEach((val, key) => {
      if (typeof key === 'string' && typeof val === 'string') {
        result[key.toLowerCase()] = val;
      }
    });
  } else if (typeof headersInput === 'object') {
    for (const [key, val] of Object.entries(headersInput)) {
      if (typeof key === 'string' && typeof val === 'string') {
        result[key.toLowerCase()] = val;
      }
    }
  }
  return result;
}

async function proxyMarketplaceRequest(url, method, headers, body) {
  const safeHeaders = parseHeaders(headers);
  delete safeHeaders['accept-encoding'];
  delete safeHeaders['content-length'];
  delete safeHeaders['user-agent'];
  delete safeHeaders['accept'];

  return invoke('marketplace_proxy', {
    url,
    method: method || 'GET',
    headers: safeHeaders,
    body: body ? String(body) : null
  });
}

// ── Intercept XMLHttpRequest ──────────────────
const OriginalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
  const xhr = new OriginalXHR();
  let _method = 'GET';
  let _url = '';
  let _requestHeaders = {};

  const originalOpen = xhr.open.bind(xhr);
  xhr.open = function(method, url, ...rest) {
    _method = method;
    _url = typeof url === 'string' ? url : (url?.toString ? url.toString() : String(url));
    return originalOpen(method, url, ...rest);
  };

  const originalSetRequestHeader = xhr.setRequestHeader.bind(xhr);
  xhr.setRequestHeader = function(name, value) {
    if (typeof name === 'string') {
      _requestHeaders[name.toLowerCase()] = String(value);
    }
    return originalSetRequestHeader(name, value);
  };

  const originalSend = xhr.send.bind(xhr);
  xhr.send = function(body) {
    if (!isMarketplaceUrl(_url)) {
      return originalSend(body);
    }

    proxyMarketplaceRequest(_url, _method, _requestHeaders, body)
      .then(text => {
        Object.defineProperty(xhr, 'status', { get: () => 200, configurable: true });
        Object.defineProperty(xhr, 'statusText', { get: () => 'OK', configurable: true });
        Object.defineProperty(xhr, 'readyState', { get: () => 4, configurable: true });
        Object.defineProperty(xhr, 'responseText', { get: () => text, configurable: true });
        Object.defineProperty(xhr, 'response', { get: () => text, configurable: true });
        xhr.getAllResponseHeaders = () => 'content-type: application/json\r\n';
        xhr.getResponseHeader = (name) => {
          if (name && name.toLowerCase() === 'content-type') return 'application/json';
          return null;
        };
        if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
        if (typeof xhr.onload === 'function') xhr.onload();
        xhr.dispatchEvent(new Event('readystatechange'));
        xhr.dispatchEvent(new Event('load'));
        xhr.dispatchEvent(new Event('loadend'));
      })
      .catch(err => {
        console.warn('[Falkon XHR Proxy] Proxy error:', err);
        Object.defineProperty(xhr, 'status', { get: () => 500, configurable: true });
        Object.defineProperty(xhr, 'statusText', { get: () => 'Internal Server Error', configurable: true });
        Object.defineProperty(xhr, 'readyState', { get: () => 4, configurable: true });
        if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
        if (typeof xhr.onerror === 'function') xhr.onerror();
        xhr.dispatchEvent(new Event('readystatechange'));
        xhr.dispatchEvent(new Event('error'));
      });
  };

  return xhr;
};
window.XMLHttpRequest.prototype = OriginalXHR.prototype;

// ── Intercept window.fetch ────────────────────
const originalFetch = window.fetch;
window.fetch = async function(resource, init) {
  let url = '';
  let method = 'GET';
  let headers = {};
  let body = null;

  if (typeof resource === 'string') {
    url = resource;
  } else if (resource && typeof resource.url === 'string') {
    url = resource.url;
    method = resource.method || 'GET';
    if (resource.headers) {
      headers = parseHeaders(resource.headers);
    }
  } else if (resource && typeof resource.toString === 'function') {
    url = resource.toString();
  }

  if (init) {
    if (init.method) method = init.method;
    if (init.headers) headers = { ...headers, ...parseHeaders(init.headers) };
    if (init.body) body = String(init.body);
  }

  if (isMarketplaceUrl(url)) {
    try {
      const responseText = await proxyMarketplaceRequest(url, method, headers, body);
      if (typeof responseText === 'string') {
        return new Response(responseText, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (err) {
      console.warn('[Falkon Fetch Proxy] Proxy error:', err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  return originalFetch.apply(this, arguments);
};
