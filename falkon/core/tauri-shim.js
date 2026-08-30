/**
 * Falkon IDE — Native Desktop Bridge Shim
 *
 * Runs before the VS Code workbench loads to provide:
 * 1. Native File Dialogs (openFolder, openFile, saveFile) via Tauri IPC
 * 2. Window Controls (minimize, maximize, close)
 * 3. Settings persistence
 * 4. Marketplace CORS Proxy
 */

let _hasWarnedNoTauri = false;
const invoke = (cmd, args) => {
  const win = window;
  if (win.__TAURI__?.core?.invoke) return win.__TAURI__.core.invoke(cmd, args);
  if (win.__TAURI_INTERNALS__?.invoke) return win.__TAURI_INTERNALS__.invoke(cmd, args);
  if (win.__TAURI_INVOKE__) return win.__TAURI_INVOKE__(cmd, args);
  if (!_hasWarnedNoTauri) {
    _hasWarnedNoTauri = true;
    console.info('[Falkon Desktop] Running in desktop shell mode.');
  }
  return Promise.resolve(null);
};

// ─────────────────────────────────────────────
//  Native File Dialogs
// ─────────────────────────────────────────────

window.__tauri_dialogs__ = {
  openFolder: async () => {
    try {
      const res = await invoke('open_folder_dialog', {});
      return typeof res === 'string' ? res : null;
    } catch (err) {
      console.warn('[Falkon Dialogs] openFolder failed:', err);
      return null;
    }
  },
  openFile: async (defaultPath) => {
    try {
      const res = await invoke('open_file_dialog', { defaultPath: typeof defaultPath === 'string' ? defaultPath : null });
      return typeof res === 'string' ? res : null;
    } catch (err) {
      console.warn('[Falkon Dialogs] openFile failed:', err);
      return null;
    }
  },
  saveFile: async (defaultName) => {
    try {
      const res = await invoke('save_file_dialog', { defaultName: defaultName ? String(defaultName) : null });
      return typeof res === 'string' ? res : null;
    } catch (err) {
      console.warn('[Falkon Dialogs] saveFile failed:', err);
      return null;
    }
  },
};

// ─────────────────────────────────────────────
//  Window Controls
// ─────────────────────────────────────────────

window.__tauri_window__ = {
  minimize: () => invoke('window_minimize', {}),
  toggleMaximize: () => invoke('window_toggle_maximize', {}),
  close: () => invoke('window_close', {}),
  openExternal: (url) => invoke('open_external_url', { url }),
};

// ─────────────────────────────────────────────
//  Settings Persistence
// ─────────────────────────────────────────────

window.__tauri_settings__ = {
  read: () => invoke('read_settings', {}),
  write: (content) => invoke('write_settings', { content }),
  readKeybindings: () => invoke('read_keybindings', {}),
};

// ─────────────────────────────────────────────
//  Deep Link URI Handler
// ─────────────────────────────────────────────

window.__falkon_handle_uri = (rawUri) => {
  try {
    const uri = typeof rawUri === 'string' ? rawUri : '';
    if (uri && (uri.startsWith('code-oss://') || uri.startsWith('vscode://'))) {
      console.log('[Falkon DeepLink] Received URI:', uri);
      window.dispatchEvent(new CustomEvent('falkon:deep-link', { detail: { uri } }));
    }
  } catch (err) {
    console.error('[Falkon DeepLink] Error handling URI:', err);
  }
};

// ─────────────────────────────────────────────
//  Marketplace CORS Proxy
// ─────────────────────────────────────────────

(function patchNetworkForMarketplace() {
  const isMarketplaceUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return (
      url.includes('marketplace.visualstudio.com') ||
      url.includes('open-vsx.org') ||
      url.includes('vsassets.io') ||
      url.includes('vscode-cdn.net')
    );
  };

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (url && isMarketplaceUrl(url)) {
      try {
        const method = (init?.method || 'GET').toUpperCase();
        const headers = {};
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((v, k) => { headers[k] = v; });
          } else if (Array.isArray(init.headers)) {
            init.headers.forEach(([k, v]) => { headers[k] = v; });
          } else {
            Object.assign(headers, init.headers);
          }
        }
        const body = typeof init?.body === 'string' ? init.body : undefined;
        const text = await invoke('marketplace_proxy', {
          targetUrl: url,
          method,
          headers: Object.keys(headers).length > 0 ? headers : null,
          body: body ?? null,
        });
        if (typeof text === 'string') {
          return new Response(text, {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (err) {
        console.warn('[Falkon Marketplace Proxy] Fetch error:', err);
      }
    }
    return origFetch.apply(this, arguments);
  };

  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    let _targetUrl = '';
    let _method = 'GET';
    let _headers = {};

    const origOpen = xhr.open;
    xhr.open = function (method, url) {
      _method = (method || 'GET').toUpperCase();
      _targetUrl = String(url || '');
      return origOpen.apply(this, arguments);
    };

    const origSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function (header, value) {
      if (header) _headers[header] = value;
      return origSetRequestHeader.apply(this, arguments);
    };

    const origSend = xhr.send;
    xhr.send = function (body) {
      if (isMarketplaceUrl(_targetUrl)) {
        invoke('marketplace_proxy', {
          targetUrl: _targetUrl,
          method: _method,
          headers: Object.keys(_headers).length > 0 ? _headers : null,
          body: typeof body === 'string' ? body : null,
        })
          .then((text) => {
            if (typeof text !== 'string') return;
            const defProp = (name, val) => {
              try { Object.defineProperty(xhr, name, { value: val, writable: true, configurable: true }); }
              catch (_) { xhr[name] = val; }
            };
            defProp('status', 200);
            defProp('statusText', 'OK');
            defProp('readyState', 4);
            defProp('responseText', text);
            let parsedResp = text;
            if (xhr.responseType === 'json') {
              try { parsedResp = JSON.parse(text); } catch (_) { parsedResp = null; }
            }
            defProp('response', parsedResp);
            xhr.getAllResponseHeaders = () => 'content-type: application/json\r\n';
            xhr.getResponseHeader = (name) => (name && name.toLowerCase() === 'content-type' ? 'application/json' : null);
            if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
            if (typeof xhr.onload === 'function') xhr.onload();
            xhr.dispatchEvent(new Event('readystatechange'));
            xhr.dispatchEvent(new Event('load'));
            xhr.dispatchEvent(new Event('loadend'));
          })
          .catch((err) => {
            console.warn('[Falkon Marketplace Proxy] XHR error:', err);
            origSend.call(xhr, body);
          });
        return;
      }
      return origSend.apply(this, arguments);
    };

    return xhr;
  };
})();
