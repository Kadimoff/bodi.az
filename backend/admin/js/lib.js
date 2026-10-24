// Core helpers shared by every admin page: rendering, API client, router,
// formatting, toasts and confirm dialogs.
import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import htm from 'htm';

export const html = htm.bind(h);

// ------------------------------------------------------------------ events
const listeners = new Map();
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}
export function emit(event, payload) {
  (listeners.get(event) || []).forEach((fn) => fn(payload));
}

// --------------------------------------------------------------------- api
export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, body, { raw = false } = {}) {
  const init = {
    method,
    credentials: 'same-origin',
    headers: { 'X-Bodi-Admin': '1', Accept: 'application/json' },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path.startsWith('/api/') ? path : `/api/admin${path}`, init);
  } catch {
    throw new ApiError('Serverlə əlaqə qurulmadı. İnternet bağlantısını yoxlayın.', 0, 'network');
  }
  if (raw) return res;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.includes('/auth/login')) emit('unauthorized');
    throw new ApiError((data && data.message) || `Xəta baş verdi (${res.status}).`, res.status, data && data.code, data && data.details);
  }
  return data;
}

export const api = {
  get: (path, query) => request('GET', query ? `${path}?${qs(query)}` : path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
  raw: (path) => request('GET', path, undefined, { raw: true }),

  // Multipart upload with progress (fetch has no upload progress).
  upload(files, onProgress) {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      [...files].forEach((f) => form.append('files', f, f.name));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/media');
      xhr.setRequestHeader('X-Bodi-Admin', '1');
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          if (xhr.status === 401) emit('unauthorized');
          reject(new ApiError((data && data.message) || 'Yükləmə alınmadı.', xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError('Yükləmə zamanı şəbəkə xətası.', 0));
      xhr.send(form);
    });
  },
};

export function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  return p.toString();
}

// ------------------------------------------------------------------ router
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(query)) };
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (replace) history.replaceState(null, '', target);
  else if (location.hash !== target) history.pushState(null, '', target);
  emit('route');
}
window.addEventListener('popstate', () => emit('route'));
window.addEventListener('hashchange', () => emit('route'));

export function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => on('route', () => setRoute(parseHash())), []);
  return route;
}

// Updates the query string of the current route (filters, pagination).
export function setQuery(patch) {
  const { path, query } = parseHash();
  const next = { ...query, ...patch };
  Object.keys(next).forEach((k) => (next[k] === '' || next[k] === undefined || next[k] === null) && delete next[k]);
  const s = qs(next);
  navigate(s ? `${path}?${s}` : path, { replace: true });
}

export function matchRoute(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const ap = path.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

// ------------------------------------------------------------------- hooks
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === seq.current) setState({ data: null, loading: false, error });
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })) };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Warn before leaving a page with unsaved edits.
export function useDirtyGuard(dirty) {
  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

// ------------------------------------------------------------------ format
const nf = new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intf = new Intl.NumberFormat('az-AZ');
export const fmt = {
  money: (n) => `${nf.format(Number(n) || 0)} ₼`,
  num: (n) => intf.format(Number(n) || 0),
  date(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Baku' });
  },
  datetime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baku' });
  },
  ago(d) {
    if (!d) return '—';
    const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'indicə';
    if (s < 3600) return `${Math.floor(s / 60)} dəq əvvəl`;
    if (s < 86400) return `${Math.floor(s / 3600)} saat əvvəl`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} gün əvvəl`;
    return fmt.date(d);
  },
  bytes(n) {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
  },
  // Value for <input type="datetime-local"> in Baku time.
  localInput(d) {
    if (!d) return '';
    const dt = new Date(d);
    const off = dt.getTimezoneOffset();
    return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
  },
};

const AZ = { ə: 'e', Ə: 'e', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u', ç: 'c', Ç: 'c', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g' };
export function slugify(s) {
  return String(s || '')
    .replace(/[əƏıIİöÖüÜçÇşŞğĞ]/g, (c) => AZ[c])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' ve ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function stripHtml(s) {
  const d = document.createElement('div');
  d.innerHTML = s || '';
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

// ----------------------------------------------------------- toasts/dialogs
let toastId = 0;
export const toast = {
  show(message, type = 'info') {
    emit('toast', { id: ++toastId, message, type });
  },
  success: (m) => toast.show(m, 'success'),
  error: (m) => toast.show(m instanceof Error ? m.message : m, 'error'),
  info: (m) => toast.show(m, 'info'),
};

export function confirmDialog(opts) {
  return new Promise((resolve) => emit('confirm', { ...opts, resolve }));
}

// Wraps an async action: toasts errors, optional success message.
export async function attempt(fn, success) {
  try {
    const r = await fn();
    if (success) toast.success(success);
    return r;
  } catch (err) {
    toast.error(err);
    throw err;
  }
}

// ----------------------------------------------------------------- session
export const session = { user: null };
export function can(perm) {
  const u = session.user;
  return !!u && (u.role === 'root' || (u.perms || []).includes(perm));
}
