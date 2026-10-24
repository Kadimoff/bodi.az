// Reusable UI building blocks.
import { useState, useEffect, useRef } from 'preact/hooks';
import { html, on, setQuery } from './lib.js';

export const Icon = ({ name, cls = '' }) => html`<span class="ms ${cls}" aria-hidden="true">${name}</span>`;

export function Button({ children, icon, variant = '', size = '', loading, type = 'button', className = '', ...rest }) {
  return html`<button type=${type} ...${rest} class="btn ${variant} ${size} ${!children ? 'icon' : ''} ${className}" disabled=${loading || rest.disabled}>
    ${loading ? html`<span class="spinner" style="width:15px;height:15px;border-width:2px"></span>` : icon ? html`<${Icon} name=${icon} />` : null}
    ${children}
  </button>`;
}

export function Field({ label, required, help, children, counter, className = '' }) {
  return html`<div class="field ${className}">
    ${label && html`<label>${label}${required && html`<span class="req">*</span>`}${counter}</label>`}
    ${children}
    ${help && html`<div class="help">${help}</div>`}
  </div>`;
}

export function Counter({ value, min, max }) {
  const n = String(value || '').length;
  const cls = !n ? 'bad' : n < min || n > max ? 'warn' : '';
  return html`<span class="counter ${cls}">${n} / ${max}</span>`;
}

export function Input({ value, onInput, className = '', ...rest }) {
  return html`<input class="input ${className}" value=${value ?? ''} onInput=${(e) => onInput && onInput(e.currentTarget.value)} ...${rest} />`;
}

export function NumberInput({ value, onInput, step = '0.01', ...rest }) {
  return html`<input class="input" type="number" inputmode="decimal" step=${step} value=${value ?? ''}
    onInput=${(e) => onInput(e.currentTarget.value === '' ? '' : e.currentTarget.value)} ...${rest} />`;
}

export function Textarea({ value, onInput, rows = 4, ...rest }) {
  return html`<textarea class="textarea" rows=${rows} value=${value ?? ''} onInput=${(e) => onInput(e.currentTarget.value)} ...${rest}></textarea>`;
}

export function Select({ value, onChange, options, placeholder, className = '', ...rest }) {
  return html`<select class="select ${className}" value=${value ?? ''} onChange=${(e) => onChange(e.currentTarget.value)} ...${rest}>
    ${placeholder !== undefined && html`<option value="">${placeholder}</option>`}
    ${options.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
  </select>`;
}

export function Switch({ checked, onChange, label, sub, disabled }) {
  return html`<label class="switch" style=${disabled ? 'opacity:.6' : ''}>
    <input type="checkbox" checked=${!!checked} disabled=${disabled} onChange=${(e) => onChange(e.currentTarget.checked)} />
    <span class="track"></span>
    <span>${label}${sub && html`<span class="sub">${sub}</span>`}</span>
  </label>`;
}

export function Card({ title, actions, children, bodyClass = 'card-body', className = '', icon }) {
  return html`<section class="card ${className}">
    ${title && html`<div class="card-head">${icon && html`<${Icon} name=${icon} />`}<h3>${title}</h3>${actions && html`<div class="actions">${actions}</div>`}</div>`}
    ${bodyClass ? html`<div class=${bodyClass}>${children}</div>` : children}
  </section>`;
}

export function PageHeader({ title, subtitle, children }) {
  return html`<div class="page-head">
    <div><h1>${title}</h1>${subtitle && html`<p>${subtitle}</p>`}</div>
    ${children && html`<div class="actions">${children}</div>`}
  </div>`;
}

export function Badge({ color = '', children }) {
  return html`<span class="badge ${color}">${children}</span>`;
}

export function Loading() {
  return html`<div class="loading"><span class="spinner"></span></div>`;
}

export function Empty({ icon = 'inventory_2', title, children }) {
  return html`<div class="empty"><${Icon} name=${icon} /><h4>${title}</h4>${children && html`<div>${children}</div>`}</div>`;
}

export function ErrorBox({ error, onRetry }) {
  return html`<div class="alert danger"><${Icon} name="error" /><div class="grow">${error?.message || 'Xəta baş verdi.'}</div>
    ${onRetry && html`<${Button} size="sm" onClick=${onRetry}>Yenidən cəhd et</${Button}>`}</div>`;
}

export function Alert({ type = 'info', icon, children }) {
  const icons = { info: 'info', warn: 'warning', danger: 'error', success: 'check_circle' };
  return html`<div class="alert ${type}"><${Icon} name=${icon || icons[type]} /><div class="grow">${children}</div></div>`;
}

export function Stars({ n }) {
  return html`<span class="stars" title=${`${n} ulduz`}>${'★'.repeat(n)}<span style="opacity:.25">${'★'.repeat(5 - n)}</span></span>`;
}

export function ScoreBadge({ score }) {
  const cls = score >= 80 ? 'good' : score >= 50 ? 'ok' : 'bad';
  return html`<span class="score ${cls}" title="SEO balı">${score}</span>`;
}

export function SearchInput({ value, onInput, placeholder = 'Axtar…' }) {
  const [v, setV] = useState(value || '');
  const t = useRef();
  useEffect(() => setV(value || ''), [value]);
  return html`<div class="search">
    <${Icon} name="search" />
    <input class="input" type="search" placeholder=${placeholder} value=${v}
      onInput=${(e) => {
        const next = e.currentTarget.value;
        setV(next);
        clearTimeout(t.current);
        t.current = setTimeout(() => onInput(next), 300);
      }} />
  </div>`;
}

export function Pager({ page, perPage, total }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return html`<div class="pager"><span>Cəmi: <b>${total}</b></span></div>`;
  return html`<div class="pager">
    <span>${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} / <b>${total}</b></span>
    <span class="spacer"></span>
    <${Button} size="sm" icon="chevron_left" disabled=${page <= 1} onClick=${() => setQuery({ page: page - 1 })} />
    <span>Səhifə ${page} / ${pages}</span>
    <${Button} size="sm" icon="chevron_right" disabled=${page >= pages} onClick=${() => setQuery({ page: page + 1 })} />
  </div>`;
}

export function FilterTabs({ value, onChange, items }) {
  return html`<div class="tabs-filter">
    ${items.map((it) => html`<button class=${value === it.value ? 'on' : ''} onClick=${() => onChange(it.value)}>
      ${it.label}${it.count !== undefined && html`<span class="n">${it.count}</span>`}
    </button>`)}
  </div>`;
}

export function Tabs({ value, onChange, items }) {
  return html`<div class="tabs" role="tablist">
    ${items.map((it) => html`<button role="tab" class=${value === it.value ? 'on' : ''} onClick=${() => onChange(it.value)}>
      ${it.icon && html`<${Icon} name=${it.icon} cls="sm" />`}${it.label}${it.flag && html`<span class="dotflag" title=${it.flag}></span>`}
    </button>`)}
  </div>`;
}

export function Modal({ title, onClose, children, footer, size = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return html`<div class="overlay" onMouseDown=${(e) => e.target === e.currentTarget && onClose && onClose()}>
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${title}</h3>${onClose && html`<${Button} variant="ghost" icon="close" onClick=${onClose} aria-label="Bağla" />`}</div>
      <div class="modal-body">${children}</div>
      ${footer && html`<div class="modal-foot">${footer}</div>`}
    </div>
  </div>`;
}

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => on('toast', (t) => {
    setItems((list) => [...list.slice(-3), t]);
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), t.type === 'error' ? 6000 : 3200);
  }), []);
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  return html`<div class="toasts" role="status" aria-live="polite">
    ${items.map((t) => html`<div class="toast ${t.type}" key=${t.id}><${Icon} name=${icons[t.type]} /><div>${t.message}</div></div>`)}
  </div>`;
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);
  const [input, setInput] = useState('');
  useEffect(() => on('confirm', (r) => { setInput(''); setReq(r); }), []);
  if (!req) return null;
  const close = (v) => { req.resolve(v); setReq(null); };
  const blocked = req.typeToConfirm && input !== req.typeToConfirm;
  return html`<${Modal} title=${req.title || 'Təsdiq edin'} onClose=${() => close(false)}
    footer=${html`<${Button} onClick=${() => close(false)}>İmtina</${Button}>
      <${Button} variant=${req.danger ? 'danger solid' : 'primary'} disabled=${blocked} onClick=${() => close(true)}>${req.confirmText || 'Təsdiq et'}</${Button}>`}>
    <p style="margin:0">${req.message}</p>
    ${req.typeToConfirm && html`<div class="mt"><${Field} label=${`Təsdiq üçün “${req.typeToConfirm}” yazın`}><${Input} value=${input} onInput=${setInput} /></${Field}></div>`}
  </${Modal}>`;
}

// Chips input for free-form lists (sizes, tags, aliases).
export function TagInput({ value = [], onChange, placeholder = 'Yazın və Enter basın', suggestions = [] }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const items = String(raw).split(/[,|]/).map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    items.forEach((i) => !next.includes(i) && next.push(i));
    onChange(next);
    setText('');
  };
  const missing = suggestions.filter((s) => !value.includes(s));
  return html`<div>
    <div class="chips">
      ${value.map((v) => html`<span class="chip">${v}<button type="button" onClick=${() => onChange(value.filter((x) => x !== v))} aria-label="Sil"><${Icon} name="close" cls="sm" /></button></span>`)}
      <input value=${text} placeholder=${value.length ? '' : placeholder}
        onInput=${(e) => setText(e.currentTarget.value)}
        onKeyDown=${(e) => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) { e.preventDefault(); add(text); }
          if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur=${() => text.trim() && add(text)} />
    </div>
    ${missing.length > 0 && html`<div class="row wrap mt-sm">
      <span class="small muted">Təklif:</span>
      ${missing.map((s) => html`<button type="button" class="btn sm" onClick=${() => onChange([...value, s])}>+ ${s}</button>`)}
    </div>`}
  </div>`;
}

export function statusBadge(status) {
  const map = {
    published: ['green', 'Dərc olunub'], draft: ['', 'Qaralama'], archived: ['dark', 'Arxiv'],
    approved: ['green', 'Təsdiqlənib'], pending: ['amber', 'Gözləyir'], rejected: ['red', 'Rədd edilib'],
    new: ['blue', 'Yeni'], processing: ['amber', 'Hazırlanır'], shipped: ['purple', 'Kuryerdə'], completed: ['green', 'Çatdırıldı'],
    cancelled: ['red', 'Ləğv edildi'], returned: ['dark', 'Qaytarıldı'],
    posted: ['green', 'Təsdiqlənib'], read: ['', 'Oxunub'],
    paid: ['green', 'Ödənilib'], unpaid: ['amber', 'Ödənilməyib'], refunded: ['dark', 'Geri qaytarılıb'],
  };
  const [color, label] = map[status] || ['', status];
  return html`<${Badge} color=${color}>${label}</${Badge}>`;
}

export function Thumb({ src, size = '' }) {
  return src
    ? html`<img class="thumb ${size}" src=${src} alt="" loading="lazy" />`
    : html`<div class="thumb ${size}" style="display:grid;place-items:center;color:var(--faint)"><${Icon} name="image" cls="sm" /></div>`;
}
