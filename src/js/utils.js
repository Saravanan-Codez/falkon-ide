/**
 * Utility helpers
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

export function safeParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function generateId(prefix = '') {
  return (prefix ? prefix + '-' : '') + Date.now();
}

const platform = (typeof window !== 'undefined' && window.electronAPI?.process?.platform) || '';
const isWin = platform === 'win32';
const sep = isWin ? '\\' : '/';
const sepRegex = /[\\/]+/g;
const sepEsc = isWin ? '\\\\' : sep;

function normalize(pathValue) {
  if (!pathValue) return '';
  let p = String(pathValue).replace(sepRegex, sep);
  let drive = '';
  if (isWin) {
    const m = /^[A-Za-z]:/.exec(p);
    if (m) {
      drive = m[0];
      p = p.slice(drive.length);
    }
  }
  const isAbsolute = isWin ? (drive && p.startsWith(sep)) : p.startsWith(sep);
  const parts = p.split(sep).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else if (!isAbsolute) out.push('..');
    } else {
      out.push(part);
    }
  }
  const prefix = isWin ? (drive + (isAbsolute ? sep : '')) : (isAbsolute ? sep : '');
  return prefix + out.join(sep);
}
function splitPath(pathValue) {
  const p = normalize(pathValue);
  if (!p) return { root: '', parts: [] };
  if (isWin) {
    const m = /^[A-Za-z]:/.exec(p);
    const root = m ? m[0] : '';
    const rest = p.slice(root.length).replace(/^\\+/, '');
    return { root, parts: rest ? rest.split(sep) : [] };
  }
  const root = p.startsWith('/') ? '/' : '';
  const rest = root ? p.slice(1) : p;
  return { root, parts: rest ? rest.split(sep) : [] };
}
function joinPath(...parts) {
  const cleaned = parts
    .filter(part => part !== undefined && part !== null && String(part).length)
    .map(part => String(part));
  if (!cleaned.length) return '';
  return normalize(cleaned.join(sep));
}

function dirname(pathValue) {
  const p = normalize(pathValue);
  if (!p) return '';
  const trimmed = p.replace(new RegExp(`${sepEsc}+$`), '');
  if (isWin) {
    if (/^[A-Za-z]:\\?$/.test(trimmed)) return trimmed;
  } else if (trimmed === '/') {
    return '/';
  }
  const idx = trimmed.lastIndexOf(sep);
  if (idx === -1) return '.';
  const root = isWin ? trimmed.slice(0, 2) : '';
  const dir = trimmed.slice(0, idx);
  if (isWin && dir === root) return root + sep;
  return dir || (isWin ? root + sep : '/');
}

function extname(pathValue) {
  const p = String(pathValue || '');
  const base = p.split(sepRegex).pop() || '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx);
}

function relative(from, to) {
  const fromSplit = splitPath(from);
  const toSplit = splitPath(to);
  if (fromSplit.root.toLowerCase() !== toSplit.root.toLowerCase()) {
    return normalize(to);
  }
  const fromParts = fromSplit.parts;
  const toParts = toSplit.parts;
  let i = 0;
  while (i < fromParts.length && i < toParts.length) {
    const a = isWin ? fromParts[i].toLowerCase() : fromParts[i];
    const b = isWin ? toParts[i].toLowerCase() : toParts[i];
    if (a !== b) break;
    i++;
  }
  const up = fromParts.length - i;
  const relParts = [];
  for (let u = 0; u < up; u++) relParts.push('..');
  relParts.push(...toParts.slice(i));
  return relParts.length ? relParts.join(sep) : '.';
}

export const path = {
  sep,
  join: joinPath,
  dirname,
  extname,
  relative
};





