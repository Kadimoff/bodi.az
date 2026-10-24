import { useState } from 'preact/hooks';
import { html, api, fmt, useAsync, setQuery, navigate, attempt, confirmDialog, emit } from '../lib.js';
import {
  Card, PageHeader, Loading, ErrorBox, Icon, Button, Field, Input, NumberInput, Textarea, Select, Switch, FilterTabs,
  SearchInput, Pager, Empty, Alert, Badge, statusBadge, Modal, Thumb,
} from '../ui.js';

const STATUS_FLOW = {
  new: ['processing', 'cancelled'],
  processing: ['shipped', 'completed', 'cancelled'],
  shipped: ['completed', 'returned', 'cancelled'],
  completed: ['returned'],
  cancelled: ['new'],
  returned: [],
};
const STATUS_LABELS = { new: 'Yeni', processing: 'Hazırlanır', shipped: 'Kuryerə verildi', completed: 'Çatdırıldı', cancelled: 'Ləğv et', returned: 'Qaytarıldı' };

export function OrderList({ query }) {
  const page = Number(query.page) || 1;
  const { data, loading, error, reload } = useAsync(() => api.get('/orders', { ...query, page, per_page: 25 }), [JSON.stringify(query)]);
  const counts = data?.counts || {};
  const sum = (...k) => k.reduce((s, x) => s + (counts[x] || 0), 0);
  return html`<div>
    <${PageHeader} title="Sifarişlər" subtitle="Saytdan və WhatsApp-dan gələn sifarişlər" />
    <div class="card">
      <${FilterTabs} value=${query.status || ''} onChange=${(v) => setQuery({ status: v, page: '' })} items=${[
        { value: '', label: 'Hamısı' },
        { value: 'open', label: 'Açıq', count: sum('new', 'processing', 'shipped') },
        { value: 'new', label: 'Yeni', count: counts.new || 0 },
        { value: 'processing', label: 'Hazırlanır', count: counts.processing || 0 },
        { value: 'shipped', label: 'Kuryerdə', count: counts.shipped || 0 },
        { value: 'completed', label: 'Çatdırılıb', count: counts.completed || 0 },
        { value: 'cancelled', label: 'Ləğv', count: counts.cancelled || 0 },
        { value: 'returned', label: 'Qaytarılıb', count: counts.returned || 0 },
      ]} />
      <div class="toolbar">
        <${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} placeholder="№, ad, telefon, ünvan…" />
        <${Select} value=${query.payment} onChange=${(v) => setQuery({ payment: v, page: '' })} placeholder="Ödəniş: hamısı"
          options=${[{ value: 'cod', label: 'Qapıda nağd' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'card', label: 'Kart' }]} />
        <input class="input" type="date" style="width:auto" value=${query.from || ''} onChange=${(e) => setQuery({ from: e.currentTarget.value, page: '' })} title="Başlanğıc tarix" />
        <input class="input" type="date" style="width:auto" value=${query.to || ''} onChange=${(e) => setQuery({ to: e.currentTarget.value, page: '' })} title="Son tarix" />
        ${data && html`<span class="small muted">Gəlir: <b>${fmt.money(data.revenue)}</b></span>`}
      </div>
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length
        ? html`<${Empty} icon="receipt_long" title="Sifariş tapılmadı" />`
        : html`<div class="table-wrap"><table class="table">
          <thead><tr><th>№</th><th>Müştəri</th><th>Şəhər</th><th class="right">Məhsul</th><th class="right">Məbləğ</th><th>Ödəniş</th><th>Status</th><th>Tarix</th></tr></thead>
          <tbody>${data.items.map((o) => html`<tr class="click" onClick=${() => navigate(`/orders/${o.id}`)}>
            <td class="mono"><b>#${o.id}</b></td>
            <td><div class="name">${o.customer || '—'}</div><div class="sub">${o.phone}</div></td>
            <td>${o.city}</td>
            <td class="right">${o.item_count}</td>
            <td class="right nowrap"><b>${fmt.money(o.total)}</b>${o.coupon_code && html`<div class="sub mono">${o.coupon_code}</div>`}</td>
            <td><div class="small">${o.payment_label}</div>${statusBadge(o.payment_status)}</td>
            <td>${statusBadge(o.status)}</td>
            <td class="small nowrap">${fmt.datetime(o.created_at)}</td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
  </div>`;
}

function waLink(o) {
  const digits = String(o.phone || '').replace(/\D/g, '');
  const msg = `Salam, ${o.first_name}! Bodi.az-dan #${o.id} nömrəli sifarişiniz barədə yazırıq.`;
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : '';
}

export function OrderDetail({ params }) {
  const { data: o, loading, error, reload, setData } = useAsync(() => api.get(`/orders/${params.id}`), [params.id]);
  const [statusModal, setStatusModal] = useState(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  if (error) return html`<${ErrorBox} error=${error} onRetry=${reload} />`;
  if (loading || !o) return html`<${Loading} />`;

  async function changeStatus() {
    setBusy(true);
    try {
      const r = await attempt(() => api.put(`/orders/${o.id}/status`, { status: statusModal, note }), 'Status yeniləndi');
      setData(r);
      setStatusModal(null);
      setNote('');
      emit('badges');
    } finally { setBusy(false); }
  }
  async function saveInfo() {
    setBusy(true);
    try {
      const r = await attempt(() => api.put(`/orders/${o.id}`, editing), 'Yadda saxlanıldı');
      setData(r);
      setEditing(null);
    } finally { setBusy(false); }
  }
  const wa = waLink(o);
  const next = STATUS_FLOW[o.status] || [];

  return html`<div>
    <${PageHeader} title=${`Sifariş #${o.id}`} subtitle=${html`${fmt.datetime(o.created_at)} · ${o.source === 'import' ? 'Köhnə sistemdən köçürülüb' : 'Saytdan'}`}>
      ${statusBadge(o.status)}
      <${Button} icon="print" onClick=${() => window.print()}>Çap et</${Button}>
      ${wa && html`<a class="btn" href=${wa} target="_blank"><${Icon} name="chat" />WhatsApp</a>`}
    </${PageHeader}>
    <div class="edit-layout">
      <div class="stack">
        <${Card} title="Məhsullar" icon="shopping_bag" bodyClass="">
          <div class="table-wrap"><table class="table">
            <thead><tr><th colspan="2">Məhsul</th><th>Variant</th><th class="right">Qiymət</th><th class="right">Say</th><th class="right">Cəmi</th></tr></thead>
            <tbody>${o.items.map((i) => html`<tr>
              <td style="width:52px"><${Thumb} src=${i.thumb} /></td>
              <td><div class="name">${i.product_id ? html`<a href=${`#/products/${i.product_id}`}>${i.name}</a>` : i.name}</div><div class="sub mono">${i.sku}</div></td>
              <td class="small">${[i.color, i.size].filter(Boolean).join(' / ') || '—'}</td>
              <td class="right">${fmt.money(i.unit_price)}</td>
              <td class="right">${i.quantity}</td>
              <td class="right"><b>${fmt.money(i.total)}</b></td>
            </tr>`)}</tbody>
          </table></div>
          <div class="card-body" style="border-top:1px solid var(--border)">
            <dl class="kv" style="max-width:320px;margin-left:auto">
              <dt>Ara cəm</dt><dd class="right">${fmt.money(o.subtotal)}</dd>
              ${o.discount > 0 && html`<dt>Endirim ${o.coupon_code && html`<span class="mono">(${o.coupon_code})</span>`}</dt><dd class="right" style="color:var(--danger)">−${fmt.money(o.discount)}</dd>`}
              <dt>Çatdırılma</dt><dd class="right">${o.shipping > 0 ? fmt.money(o.shipping) : 'Pulsuz'}</dd>
              <dt><b>Yekun</b></dt><dd class="right" style="font-size:17px"><b>${fmt.money(o.total)}</b></dd>
            </dl>
          </div>
        </${Card}>
        <${Card} title="Status tarixçəsi" icon="timeline">
          <ul class="timeline">
            ${o.history.map((h) => html`<li><b>${h.label}</b> <span class="small muted">· ${fmt.datetime(h.created_at)}${h.username ? ` · ${h.username}` : ''}</span>${h.note && html`<div class="small">${h.note}</div>`}</li>`)}
          </ul>
        </${Card}>
        ${o.movements.length > 0 && html`<${Card} title="Anbar hərəkətləri" icon="swap_vert" bodyClass="">
          <div class="table-wrap"><table class="table"><tbody>
            ${o.movements.map((m) => html`<tr><td>${m.type_label}</td><td class="mono small">${m.sku}</td><td>${m.warehouse_name}</td>
              <td class="right"><span class="qty ${m.quantity < 0 ? 'neg' : ''}">${m.quantity > 0 ? '+' : ''}${m.quantity}</span></td><td class="small muted">${fmt.datetime(m.created_at)}</td></tr>`)}
          </tbody></table></div>
        </${Card}>`}
      </div>
      <div class="side">
        <${Card} title="Statusu dəyiş" icon="published_with_changes">
          ${next.length ? html`<div class="stack" style="gap:8px">
            ${next.map((s) => html`<${Button} variant=${s === 'cancelled' || s === 'returned' ? 'danger' : 'primary'} onClick=${() => setStatusModal(s)}>${STATUS_LABELS[s]}</${Button}>`)}
            <div class="small muted">Ləğv və qaytarma məhsulları anbara geri qaytarır.</div>
          </div>` : html`<div class="small muted">Bu statusdan sonra keçid yoxdur.</div>`}
        </${Card}>
        <${Card} title="Müştəri" icon="person" actions=${!editing && html`<${Button} size="sm" icon="edit" onClick=${() => setEditing({ first_name: o.first_name, last_name: o.last_name, phone: o.phone, email: o.email, city: o.city, address: o.address, admin_note: o.admin_note, payment_status: o.payment_status })} />`}>
          ${editing ? html`<div class="stack">
            <div class="form-grid">
              <${Field} label="Ad"><${Input} value=${editing.first_name} onInput=${(v) => setEditing({ ...editing, first_name: v })} /></${Field}>
              <${Field} label="Soyad"><${Input} value=${editing.last_name} onInput=${(v) => setEditing({ ...editing, last_name: v })} /></${Field}>
            </div>
            <${Field} label="Telefon"><${Input} value=${editing.phone} onInput=${(v) => setEditing({ ...editing, phone: v })} /></${Field}>
            <${Field} label="Şəhər"><${Input} value=${editing.city} onInput=${(v) => setEditing({ ...editing, city: v })} /></${Field}>
            <${Field} label="Ünvan"><${Textarea} rows="2" value=${editing.address} onInput=${(v) => setEditing({ ...editing, address: v })} /></${Field}>
            <${Field} label="Ödəniş statusu"><${Select} value=${editing.payment_status} onChange=${(v) => setEditing({ ...editing, payment_status: v })}
              options=${[{ value: 'unpaid', label: 'Ödənilməyib' }, { value: 'paid', label: 'Ödənilib' }, { value: 'refunded', label: 'Geri qaytarılıb' }]} /></${Field}>
            <${Field} label="Daxili qeyd" help="Müştəri görmür."><${Textarea} rows="3" value=${editing.admin_note} onInput=${(v) => setEditing({ ...editing, admin_note: v })} /></${Field}>
            <div class="row"><${Button} onClick=${() => setEditing(null)}>İmtina</${Button}><${Button} variant="primary" loading=${busy} onClick=${saveInfo}>Saxla</${Button}></div>
          </div>` : html`<dl class="kv">
            <dt>Ad</dt><dd>${`${o.first_name} ${o.last_name}`.trim() || '—'}</dd>
            <dt>Telefon</dt><dd><a href=${`tel:${o.phone}`}>${o.phone}</a></dd>
            ${o.email && html`<dt>E-poçt</dt><dd>${o.email}</dd>`}
            <dt>Ünvan</dt><dd>${o.city}${o.city && o.address ? ', ' : ''}${o.address}</dd>
            <dt>Ödəniş</dt><dd>${o.payment_label}<br />${statusBadge(o.payment_status)}</dd>
            ${o.customer_note && html`<dt>Müştəri qeydi</dt><dd>${o.customer_note}</dd>`}
            ${o.admin_note && html`<dt>Daxili qeyd</dt><dd>${o.admin_note}</dd>`}
          </dl>`}
        </${Card}>
        <${Card} title="Anbar" icon="inventory_2">
          <div class="small">${o.stock_applied ? html`<${Badge} color="green">Stokdan çıxılıb</${Badge}>` : html`<${Badge}>Stok təsiri yoxdur</${Badge}>`}</div>
          <div class="small muted mt-sm">Stoku izlənən məhsullar sifariş anında anbardan avtomatik çıxılır.</div>
        </${Card}>
      </div>
    </div>
    ${statusModal && html`<${Modal} title=${`Status: ${STATUS_LABELS[statusModal]}`} onClose=${() => setStatusModal(null)}
      footer=${html`<${Button} onClick=${() => setStatusModal(null)}>İmtina</${Button}><${Button} variant=${statusModal === 'cancelled' ? 'danger solid' : 'primary'} loading=${busy} onClick=${changeStatus}>Təsdiqlə</${Button}>`}>
      ${(statusModal === 'cancelled' || statusModal === 'returned') && o.stock_applied && html`<${Alert} type="info">Məhsullar anbara avtomatik qaytarılacaq.</${Alert}>`}
      <div class="mt"><${Field} label="Qeyd (istəyə bağlı)"><${Textarea} rows="3" value=${note} onInput=${setNote} placeholder="Məs: kuryer Elvin, ödəniş nağd alındı" /></${Field}></div>
    </${Modal}>`}
  </div>`;
}

// ---------------------------------------------------------------- coupons
function CouponModal({ item, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    code: '', type: 'percent', amount: '', min_subtotal: 0, usage_limit: '', starts_at: '', expires_at: '', is_active: true, description: '',
    ...item,
    starts_at: item?.starts_at ? fmt.localInput(item.starts_at) : '',
    expires_at: item?.expires_at ? fmt.localInput(item.expires_at) : '',
    usage_limit: item?.usage_limit ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      // datetime-local is in the browser's zone; send an absolute timestamp.
      const iso = (v) => (v ? new Date(v).toISOString() : null);
      const body = { ...f, starts_at: iso(f.starts_at), expires_at: iso(f.expires_at) };
      await attempt(() => (item?.id ? api.put(`/coupons/${item.id}`, body) : api.post('/coupons', body)), 'Promokod yadda saxlanıldı');
      onSaved();
    } finally { setBusy(false); }
  }
  return html`<${Modal} title=${item?.id ? f.code : 'Yeni promokod'} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" loading=${busy} onClick=${save}>Yadda saxla</${Button}>`}>
    <div class="stack">
      <div class="form-grid">
        <${Field} label="Kod" required><${Input} className="mono" value=${f.code} onInput=${(v) => set('code', v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="YAY20" /></${Field}>
        <${Field} label="Növ"><${Select} value=${f.type} onChange=${(v) => set('type', v)} options=${[{ value: 'percent', label: 'Faiz (%)' }, { value: 'fixed', label: 'Sabit məbləğ (₼)' }]} /></${Field}>
        <${Field} label="Endirim" required><div class="input-group"><${NumberInput} value=${f.amount} onInput=${(v) => set('amount', v)} /><span class="addon">${f.type === 'percent' ? '%' : '₼'}</span></div></${Field}>
        <${Field} label="Minimum səbət"><div class="input-group"><${NumberInput} value=${f.min_subtotal} onInput=${(v) => set('min_subtotal', v)} /><span class="addon">₼</span></div></${Field}>
        <${Field} label="İstifadə limiti" help="Boş — limitsiz"><${NumberInput} step="1" value=${f.usage_limit} onInput=${(v) => set('usage_limit', v)} /></${Field}>
        <div></div>
        <${Field} label="Başlama"><input class="input" type="datetime-local" value=${f.starts_at} onInput=${(e) => set('starts_at', e.currentTarget.value)} /></${Field}>
        <${Field} label="Bitmə"><input class="input" type="datetime-local" value=${f.expires_at} onInput=${(e) => set('expires_at', e.currentTarget.value)} /></${Field}>
      </div>
      <${Field} label="Təsvir"><${Input} value=${f.description} onInput=${(v) => set('description', v)} /></${Field}>
      <${Switch} checked=${f.is_active} onChange=${(v) => set('is_active', v)} label="Aktiv" />
    </div>
  </${Modal}>`;
}

export function Coupons() {
  const { data, loading, error, reload } = useAsync(() => api.get('/coupons'), []);
  const [edit, setEdit] = useState(null);
  async function remove(c) {
    if (!(await confirmDialog({ title: 'Promokodu silmək', message: `${c.code} silinsin?`, confirmText: 'Sil', danger: true }))) return;
    await attempt(() => api.del(`/coupons/${c.id}`), 'Silindi');
    reload();
  }
  const state = (c) => {
    if (!c.is_active) return html`<${Badge}>Deaktiv</${Badge}>`;
    if (c.expires_at && new Date(c.expires_at) < new Date()) return html`<${Badge} color="red">Bitib</${Badge}>`;
    if (c.usage_limit != null && c.used_count >= c.usage_limit) return html`<${Badge} color="red">Limit dolub</${Badge}>`;
    if (c.starts_at && new Date(c.starts_at) > new Date()) return html`<${Badge} color="blue">Planlaşdırılıb</${Badge}>`;
    return html`<${Badge} color="green">Aktiv</${Badge}>`;
  };
  return html`<div>
    <${PageHeader} title="Promokodlar" subtitle="Səbət və ödəniş səhifəsində tətbiq olunan endirim kodları">
      <${Button} variant="primary" icon="add" onClick=${() => setEdit({})}>Yeni promokod</${Button}>
    </${PageHeader}>
    <div class="card">
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading ? html`<${Loading} />` : !data.length ? html`<${Empty} icon="sell" title="Promokod yoxdur" />` : html`
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Kod</th><th>Endirim</th><th>Minimum</th><th>İstifadə</th><th>Müddət</th><th>Status</th><th></th></tr></thead>
          <tbody>${data.map((c) => html`<tr class="click" onClick=${() => setEdit(c)}>
            <td><b class="mono">${c.code}</b><div class="sub">${c.description}</div></td>
            <td><b>${c.type === 'percent' ? `${c.amount}%` : fmt.money(c.amount)}</b></td>
            <td>${c.min_subtotal > 0 ? fmt.money(c.min_subtotal) : '—'}</td>
            <td>${c.used_count}${c.usage_limit != null ? ` / ${c.usage_limit}` : ''}</td>
            <td class="small">${c.starts_at ? fmt.date(c.starts_at) : '…'} — ${c.expires_at ? fmt.date(c.expires_at) : '∞'}</td>
            <td>${state(c)}</td>
            <td onClick=${(e) => e.stopPropagation()}><${Button} size="sm" variant="ghost" icon="delete" onClick=${() => remove(c)} /></td>
          </tr>`)}</tbody>
        </table></div>`}
    </div>
    ${edit && html`<${CouponModal} item=${edit.id ? edit : null} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); reload(); }} />`}
  </div>`;
}
