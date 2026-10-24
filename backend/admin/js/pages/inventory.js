import { useState, useEffect, useRef } from 'preact/hooks';
import { html, api, fmt, useAsync, setQuery, navigate, attempt, confirmDialog, qs, useDebounced } from '../lib.js';
import {
  Card, PageHeader, Loading, ErrorBox, Icon, Button, Field, Input, NumberInput, Textarea, Select, Switch, FilterTabs,
  SearchInput, Pager, Empty, Alert, Badge, statusBadge, Modal, Thumb,
} from '../ui.js';

const DOC_TYPES = {
  receipt: { label: 'Mədaxil', icon: 'input', help: 'Təchizatçıdan və ya istehsaldan anbara qəbul.' },
  issue: { label: 'Məxaric', icon: 'output', help: 'Zay, itki, nümunə və ya daxili istifadə üçün anbardan çıxış.' },
  transfer: { label: 'Transfer', icon: 'sync_alt', help: 'Bir anbardan digərinə köçürmə.' },
  adjustment: { label: 'İnventarizasiya', icon: 'fact_check', help: 'Faktiki sayım: sistem qalığı sayılmış miqdara bərabərləşdirilir.' },
};
const MOVE_COLORS = { receipt: 'green', return: 'green', transfer_in: 'blue', issue: 'red', sale: 'purple', transfer_out: 'blue', adjustment: 'amber' };

function qtyClass(q, min = 0) {
  return q < 0 ? 'neg' : q === 0 ? 'zero' : q <= Math.max(min, 3) ? 'low' : '';
}

function useWarehouses() {
  return useAsync(() => api.get('/inventory/warehouses'), []);
}

// ------------------------------------------------------------------ stock
function LevelModal({ variant, warehouse, onClose, onSaved }) {
  const lvl = variant.levels[warehouse.id] || { min_quantity: 0, bin_location: '' };
  const [f, setF] = useState({ min_quantity: lvl.min_quantity, bin_location: lvl.bin_location });
  async function save() {
    await attempt(() => api.put(`/inventory/stock/${variant.id}/${warehouse.id}`, f), 'Yadda saxlanıldı');
    onSaved();
  }
  return html`<${Modal} title=${`${variant.sku} — ${warehouse.name}`} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" onClick=${save}>Saxla</${Button}>`}>
    <div class="form-grid">
      <${Field} label="Minimum qalıq" help="Bu həddə düşəndə “az qalıb” xəbərdarlığı."><${NumberInput} step="1" min="0" value=${f.min_quantity} onInput=${(v) => setF({ ...f, min_quantity: v })} /></${Field}>
      <${Field} label="Rəf / yer"><${Input} value=${f.bin_location} onInput=${(v) => setF({ ...f, bin_location: v })} placeholder="A-03-2" /></${Field}>
    </div>
  </${Modal}>`;
}

function QuickOp({ variant, warehouses, onClose, onDone }) {
  const [f, setF] = useState({ mode: 'receipt', warehouse_id: warehouses.find((w) => w.is_default)?.id || warehouses[0]?.id, quantity: '', unit_cost: '', note: '' });
  const [busy, setBusy] = useState(false);
  const current = variant.levels[f.warehouse_id]?.quantity || 0;
  async function submit() {
    setBusy(true);
    try {
      await attempt(() => api.post('/inventory/quick', { ...f, variant_id: variant.id }), 'Stok yeniləndi');
      onDone();
    } finally { setBusy(false); }
  }
  return html`<${Modal} title=${`Stok əməliyyatı — ${variant.product_name}`} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" loading=${busy} onClick=${submit}>Təsdiqlə</${Button}>`}>
    <div class="stack">
      <div class="small muted"><span class="mono">${variant.sku}</span> · ${variant.label}</div>
      <${Field} label="Əməliyyat"><${Select} value=${f.mode} onChange=${(v) => setF({ ...f, mode: v })} options=${[
        { value: 'receipt', label: 'Mədaxil (+)' }, { value: 'issue', label: 'Məxaric (−)' }, { value: 'set', label: 'Sayım — dəqiq qalıq' },
      ]} /></${Field}>
      <${Field} label="Anbar" help=${`Hazırkı qalıq: ${current}`}><${Select} value=${f.warehouse_id} onChange=${(v) => setF({ ...f, warehouse_id: Number(v) })} options=${warehouses.map((w) => ({ value: w.id, label: w.name }))} /></${Field}>
      <div class="form-grid">
        <${Field} label="Miqdar" required><${NumberInput} step="1" min="0" value=${f.quantity} onInput=${(v) => setF({ ...f, quantity: v })} /></${Field}>
        ${f.mode === 'receipt' && html`<${Field} label="Vahid maya dəyəri"><${NumberInput} value=${f.unit_cost} onInput=${(v) => setF({ ...f, unit_cost: v })} /></${Field}>`}
      </div>
      <${Field} label="Qeyd"><${Input} value=${f.note} onInput=${(v) => setF({ ...f, note: v })} /></${Field}>
    </div>
  </${Modal}>`;
}

export function Stock({ query }) {
  const page = Number(query.page) || 1;
  const wh = useWarehouses();
  const summary = useAsync(() => api.get('/inventory/summary'), []);
  const { data, loading, error, reload } = useAsync(() => api.get('/inventory/stock', { ...query, page, per_page: 50 }), [JSON.stringify(query)]);
  const [op, setOp] = useState(null);
  const [level, setLevel] = useState(null);
  const warehouses = (wh.data || []).filter((w) => w.is_active);
  const s = summary.data;
  const refresh = () => { reload(); summary.reload(); };

  return html`<div>
    <${PageHeader} title="Stok qalıqları" subtitle="Hər variantın anbarlar üzrə qalığı">
      <a class="btn" href=${`/api/admin/inventory/stock.csv?${qs({ q: query.q, filter: query.filter, tracked: query.tracked })}`}><${Icon} name="download" />Excel (CSV)</a>
      <${Button} icon="fact_check" onClick=${() => navigate('/inventory/documents/new?type=adjustment')}>İnventarizasiya</${Button}>
      <${Button} variant="primary" icon="input" onClick=${() => navigate('/inventory/documents/new?type=receipt')}>Mədaxil</${Button}>
    </${PageHeader}>
    ${s && html`<div class="grid grid-4" style="margin-bottom:16px">
      <div class="card stat"><div class="label"><${Icon} name="view_module" cls="sm" />Variantlar</div><div class="value">${fmt.num(s.variants)}</div><div class="hint">${s.tracked} izlənir</div></div>
      <div class="card stat"><div class="label"><${Icon} name="inventory_2" cls="sm" />Anbardakı ədəd</div><div class="value">${fmt.num(s.units)}</div><div class="hint">${s.draft_documents} qaralama sənəd</div></div>
      <div class="card stat"><div class="label"><${Icon} name="account_balance_wallet" cls="sm" />Maya dəyəri ilə</div><div class="value">${fmt.money(s.cost_value)}</div><div class="hint">Satış qiyməti ilə: ${fmt.money(s.retail_value)}</div></div>
      <a class="card stat" href="#/inventory?filter=low" style="text-decoration:none;color:inherit"><div class="label"><${Icon} name="warning" cls="sm" />Problemli</div><div class="value">${s.out_of_stock + s.low_stock}</div><div class="hint">${s.out_of_stock} bitib · ${s.low_stock} az qalıb</div></a>
    </div>`}
    <div class="card">
      <${FilterTabs} value=${query.filter || ''} onChange=${(v) => setQuery({ filter: v, page: '' })} items=${[
        { value: '', label: 'Hamısı' }, { value: 'in', label: 'Stokda var' }, { value: 'low', label: 'Az qalıb' }, { value: 'out', label: 'Bitib' }, { value: 'negative', label: 'Mənfi qalıq' },
      ]} />
      <div class="toolbar">
        <${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} placeholder="Məhsul, SKU və ya barkod…" />
        <label class="check small"><input type="checkbox" checked=${query.tracked === '1'} onChange=${(e) => setQuery({ tracked: e.currentTarget.checked ? '1' : '', page: '' })} />Yalnız stoku izlənənlər</label>
      </div>
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length
        ? html`<${Empty} icon="inventory_2" title="Nəticə yoxdur" />`
        : html`<div class="table-wrap"><table class="table matrix">
          <thead><tr><th colspan="2">Məhsul / variant</th><th>SKU</th>${warehouses.map((w) => html`<th class="right">${w.name}</th>`)}<th class="right">Cəmi</th><th></th></tr></thead>
          <tbody>${data.items.map((v) => html`<tr>
            <td style="width:44px"><${Thumb} src=${v.thumb} size="sm" /></td>
            <td style="text-align:left"><a class="name" href=${`#/products/${v.product_id}?tab=variants`}>${v.product_name}</a>
              <div class="sub">${v.color_hex && html`<span class="color-dot" style=${`background:${v.color_hex}`}></span> `}${v.label || '—'} ${!v.track_stock && html`<${Badge}>izlənmir</${Badge}>`}</div></td>
            <td class="mono small" style="text-align:left">${v.sku}</td>
            ${warehouses.map((w) => {
              const l = v.levels[w.id];
              const q = l?.quantity || 0;
              return html`<td class="right"><button class="btn ghost sm" title="Minimum qalıq / rəf" onClick=${() => setLevel({ v, w })}>
                <span class="qty ${qtyClass(q, l?.min_quantity)}">${q}</span>${l?.bin_location && html`<span class="faint small"> · ${l.bin_location}</span>`}
              </button></td>`;
            })}
            <td class="right"><span class="qty ${qtyClass(v.total, v.min_total)}">${v.total}</span></td>
            <td><div class="cell-actions">
              <${Button} size="sm" icon="add_box" title="Stok əməliyyatı" onClick=${() => setOp(v)} />
              <a class="btn sm icon" title="Hərəkətlər" href=${`#/inventory/movements?variant_id=${v.id}`}><${Icon} name="history" /></a>
            </div></td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
    ${op && html`<${QuickOp} variant=${op} warehouses=${warehouses} onClose=${() => setOp(null)} onDone=${() => { setOp(null); refresh(); }} />`}
    ${level && html`<${LevelModal} variant=${level.v} warehouse=${level.w} onClose=${() => setLevel(null)} onSaved=${() => { setLevel(null); reload(); }} />`}
  </div>`;
}

// -------------------------------------------------------------- documents
export function Documents({ query }) {
  const page = Number(query.page) || 1;
  const { data, loading, error, reload } = useAsync(() => api.get('/inventory/documents', { ...query, page }), [JSON.stringify(query)]);
  return html`<div>
    <${PageHeader} title="Anbar sənədləri" subtitle="Mədaxil, məxaric, transfer və inventarizasiya sənədləri">
      ${Object.entries(DOC_TYPES).map(([k, t]) => html`<${Button} variant=${k === 'receipt' ? 'primary' : ''} icon=${t.icon} onClick=${() => navigate(`/inventory/documents/new?type=${k}`)}>${t.label}</${Button}>`)}
    </${PageHeader}>
    <div class="card">
      <${FilterTabs} value=${query.type || ''} onChange=${(v) => setQuery({ type: v, page: '' })} items=${[{ value: '', label: 'Hamısı' }, ...Object.entries(DOC_TYPES).map(([k, t]) => ({ value: k, label: t.label }))]} />
      <div class="toolbar">
        <${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} placeholder="Sənəd №, qaimə, qeyd…" />
        <${Select} value=${query.status} onChange=${(v) => setQuery({ status: v, page: '' })} placeholder="Status: hamısı"
          options=${[{ value: 'draft', label: 'Qaralama' }, { value: 'posted', label: 'Təsdiqlənib' }, { value: 'cancelled', label: 'Ləğv edilib' }]} />
      </div>
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length
        ? html`<${Empty} icon="description" title="Sənəd yoxdur">Anbara ilk mədaxili edin.</${Empty}>`
        : html`<div class="table-wrap"><table class="table">
          <thead><tr><th>Sənəd №</th><th>Növ</th><th>Tarix</th><th>Anbar</th><th>Təchizatçı / qaimə</th><th class="right">Sətir</th><th class="right">Miqdar</th><th>Status</th><th>Yaradan</th></tr></thead>
          <tbody>${data.items.map((d) => html`<tr class="click" onClick=${() => navigate(`/inventory/documents/${d.id}`)}>
            <td class="mono"><b>${d.doc_no}</b></td>
            <td><${Icon} name=${DOC_TYPES[d.type].icon} cls="sm" /> ${d.type_label}</td>
            <td class="small nowrap">${fmt.date(d.doc_date)}</td>
            <td>${d.warehouse_name}${d.target_warehouse_name && html` → ${d.target_warehouse_name}`}</td>
            <td class="small">${d.supplier_name || ''}${d.reference && html`<div class="mono">${d.reference}</div>`}</td>
            <td class="right">${d.line_count}</td>
            <td class="right"><b>${d.total_quantity}</b></td>
            <td>${statusBadge(d.status)}</td>
            <td class="small">${d.created_by_name || '—'}</td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
  </div>`;
}

function VariantSearch({ onPick, warehouseId }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 250);
  const [items, setItems] = useState([]);
  const box = useRef();
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api.get('/inventory/variants', { q: dq }).then((r) => alive && setItems(r)).catch(() => {});
    return () => { alive = false; };
  }, [dq, open]);
  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return html`<div ref=${box} style="position:relative">
    <div class="search"><${Icon} name="add" />
      <input class="input" placeholder="Məhsul, SKU və ya barkod ilə axtarıb əlavə edin…" value=${q}
        onFocus=${() => setOpen(true)} onInput=${(e) => { setQ(e.currentTarget.value); setOpen(true); }}
        onKeyDown=${(e) => { if (e.key === 'Enter' && items[0]) { e.preventDefault(); onPick(items[0]); setQ(''); } }} />
    </div>
    ${open && items.length > 0 && html`<div class="card" style="position:absolute;z-index:30;left:0;right:0;top:42px;max-height:320px;overflow:auto">
      ${items.map((v) => html`<div class="row" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border)"
          onMouseDown=${(e) => { e.preventDefault(); onPick(v); setQ(''); setOpen(false); }}>
        <${Thumb} src=${v.thumb} size="sm" />
        <div class="grow"><div class="name">${v.product_name}</div><div class="sub"><span class="mono">${v.sku}</span> · ${v.label}</div></div>
        <span class="small muted">${warehouseId ? `Qalıq: ${v.levels[warehouseId]?.quantity || 0}` : `Cəmi: ${v.total}`}</span>
      </div>`)}
    </div>`}
  </div>`;
}

export function DocumentEdit({ params, query }) {
  const isNew = params.id === 'new';
  const wh = useWarehouses();
  const sup = useAsync(() => api.get('/inventory/suppliers'), []);
  const doc = useAsync(() => (isNew ? Promise.resolve(null) : api.get(`/inventory/documents/${params.id}`)), [params.id]);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wh.data) return;
    if (isNew) {
      const type = DOC_TYPES[query.type] ? query.type : 'receipt';
      const def = wh.data.find((w) => w.is_default) || wh.data[0];
      setF({ type, warehouse_id: def?.id || '', target_warehouse_id: '', supplier_id: '', reference: '', note: '', doc_date: new Date().toISOString().slice(0, 10), lines: [] });
      if (query.product_id) {
        api.get('/inventory/variants', { product_id: query.product_id }).then((vs) => setF((x) => ({ ...x, lines: vs.map((v) => lineFrom(v, def?.id)) })));
      }
    } else if (doc.data) {
      const d = doc.data;
      setF({
        ...d,
        doc_date: String(d.doc_date).slice(0, 10),
        target_warehouse_id: d.target_warehouse_id || '',
        supplier_id: d.supplier_id || '',
        lines: d.lines.map((l) => ({ variant_id: l.variant_id, sku: l.sku, product_name: l.product_name, label: [l.color_name || l.color, l.size].filter(Boolean).join(' / '), quantity: l.quantity, unit_cost: l.unit_cost ?? '', current: l.current_quantity, note: l.note })),
      });
    }
  }, [wh.data, doc.data, isNew]);

  function lineFrom(v, warehouseId) {
    return { variant_id: v.id, sku: v.sku, product_name: v.product_name, label: v.label, quantity: f?.type === 'adjustment' ? v.levels[warehouseId]?.quantity || 0 : '', unit_cost: v.cost_price ?? '', current: v.levels[warehouseId]?.quantity || 0, note: '' };
  }

  if (wh.error || doc.error) return html`<${ErrorBox} error=${wh.error || doc.error} />`;
  if (!f) return html`<${Loading} />`;
  const t = DOC_TYPES[f.type];
  const readOnly = !isNew && f.status !== 'draft';
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setLine = (i, k, v) => setF((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const warehouses = (wh.data || []).filter((w) => w.is_active || w.id === f.warehouse_id);
  const totalQty = f.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalCost = f.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);

  async function save(post) {
    if (post) {
      const ok = await confirmDialog({
        title: `${t.label} sənədini təsdiqləmək`,
        message: `${f.lines.length} sətir, cəmi ${totalQty} ədəd. Təsdiqləndikdən sonra sənəd dəyişdirilə bilməz və qalıqlar dərhal yenilənir.`,
        confirmText: 'Təsdiqlə',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const body = { ...f, post, lines: f.lines.map((l) => ({ variant_id: l.variant_id, quantity: Number(l.quantity) || 0, unit_cost: l.unit_cost === '' ? null : l.unit_cost, note: l.note })) };
      const r = await attempt(() => (isNew ? api.post('/inventory/documents', body) : api.put(`/inventory/documents/${params.id}`, body)), post ? 'Sənəd təsdiqləndi, qalıqlar yeniləndi' : 'Qaralama saxlanıldı');
      if (isNew) navigate(`/inventory/documents/${r.id}`, { replace: true });
      else doc.setData(r);
    } finally { setBusy(false); }
  }
  async function action(path, msg, confirmMsg) {
    if (confirmMsg && !(await confirmDialog({ title: 'Təsdiq edin', message: confirmMsg, danger: true }))) return;
    const r = await attempt(() => api.post(`/inventory/documents/${params.id}/${path}`), msg);
    if (path === 'reverse') navigate(`/inventory/documents/${r.id}`);
    else doc.setData(r);
  }
  async function remove() {
    if (!(await confirmDialog({ title: 'Sənədi silmək', message: 'Qaralama sənəd silinsin?', danger: true, confirmText: 'Sil' }))) return;
    await attempt(() => api.del(`/inventory/documents/${params.id}`), 'Silindi');
    navigate('/inventory/documents');
  }

  return html`<div>
    <${PageHeader} title=${isNew ? `Yeni ${t.label.toLowerCase()}` : `${t.label} ${f.doc_no}`} subtitle=${t.help}>
      ${!isNew && statusBadge(f.status)}
      ${!isNew && html`<${Button} icon="print" onClick=${() => window.print()}>Çap</${Button}>`}
      ${readOnly && f.status === 'posted' && f.type !== 'adjustment' && html`<${Button} icon="undo" onClick=${() => action('reverse', 'Əks sənəd yaradıldı və təsdiqləndi', 'Bu sənədin əksi yaradılacaq və dərhal təsdiqlənəcək (məs. mədaxil → məxaric). Davam edilsin?')}>Əks sənəd</${Button}>`}
      ${!readOnly && html`
        ${!isNew && html`<${Button} variant="danger" icon="delete" onClick=${remove}>Sil</${Button}>`}
        <${Button} icon="save" loading=${busy} onClick=${() => save(false)}>Qaralama</${Button}>
        <${Button} variant="primary" icon="task_alt" loading=${busy} disabled=${!f.lines.length} onClick=${() => save(true)}>Təsdiqlə</${Button}>`}
    </${PageHeader}>
    ${readOnly && f.status === 'posted' && html`<div style="margin-bottom:16px"><${Alert} type="success">Təsdiqlənib: ${fmt.datetime(f.posted_at)}${f.posted_by_name ? ` · ${f.posted_by_name}` : ''}. Düzəliş üçün əks sənəd yaradın.</${Alert}></div>`}
    <div class="stack">
      <${Card}>
        <div class="grid grid-4">
          <${Field} label=${f.type === 'transfer' ? 'Çıxış anbarı' : 'Anbar'} required>
            <${Select} value=${f.warehouse_id} disabled=${readOnly} onChange=${(v) => set('warehouse_id', Number(v))} options=${warehouses.map((w) => ({ value: w.id, label: w.name }))} />
          </${Field}>
          ${f.type === 'transfer' && html`<${Field} label="Təyinat anbarı" required>
            <${Select} value=${f.target_warehouse_id} disabled=${readOnly} onChange=${(v) => set('target_warehouse_id', Number(v))} placeholder="Seçin" options=${warehouses.filter((w) => w.id !== f.warehouse_id).map((w) => ({ value: w.id, label: w.name }))} />
          </${Field}>`}
          ${f.type === 'receipt' && html`<${Field} label="Təchizatçı">
            <${Select} value=${f.supplier_id} disabled=${readOnly} onChange=${(v) => set('supplier_id', v)} placeholder="— Seçilməyib —" options=${(sup.data || []).filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))} />
          </${Field}>`}
          <${Field} label="Qaimə / sənəd №"><${Input} value=${f.reference} disabled=${readOnly} onInput=${(v) => set('reference', v)} /></${Field}>
          <${Field} label="Tarix"><input class="input" type="date" value=${f.doc_date} disabled=${readOnly} onInput=${(e) => set('doc_date', e.currentTarget.value)} /></${Field}>
        </div>
        <div class="mt"><${Field} label="Qeyd"><${Textarea} rows="2" value=${f.note} disabled=${readOnly} onInput=${(v) => set('note', v)} /></${Field}></div>
      </${Card}>
      <${Card} title=${`Məhsullar (${f.lines.length})`} icon="list" bodyClass="">
        ${!readOnly && html`<div class="card-body" style="padding-bottom:0"><${VariantSearch} warehouseId=${f.warehouse_id} onPick=${(v) => {
          if (f.lines.some((l) => l.variant_id === v.id)) return;
          setF((x) => ({ ...x, lines: [...x.lines, lineFrom(v, x.warehouse_id)] }));
        }} /></div>`}
        ${!f.lines.length ? html`<${Empty} icon="playlist_add" title="Sətir yoxdur">Yuxarıdan məhsul axtarıb əlavə edin.</${Empty}>` : html`<div class="table-wrap mt"><table class="table">
          <thead><tr><th>Məhsul</th><th>SKU</th>
            <th class="right">${f.type === 'adjustment' ? 'Sistemdə' : 'Qalıq'}</th>
            <th class="right">${f.type === 'adjustment' ? 'Sayılmış' : 'Miqdar'}</th>
            ${f.type === 'adjustment' && html`<th class="right">Fərq</th>`}
            ${f.type === 'receipt' && html`<th class="right">Vahid maya</th><th class="right">Cəmi</th>`}
            <th>Qeyd</th>${!readOnly && html`<th></th>`}</tr></thead>
          <tbody>${f.lines.map((l, i) => {
            const diff = (Number(l.quantity) || 0) - (l.current || 0);
            return html`<tr>
              <td><div class="name">${l.product_name}</div><div class="sub">${l.label}</div></td>
              <td class="mono small">${l.sku}</td>
              <td class="right"><span class="qty ${qtyClass(l.current)}">${l.current ?? '—'}</span></td>
              <td class="right">${readOnly ? html`<b>${l.quantity}</b>` : html`<input class="input sm" type="number" min="0" step="1" style="width:90px;text-align:right" value=${l.quantity} onInput=${(e) => setLine(i, 'quantity', e.currentTarget.value)} />`}</td>
              ${f.type === 'adjustment' && html`<td class="right"><span class="qty ${diff < 0 ? 'neg' : diff > 0 ? '' : 'zero'}">${diff > 0 ? '+' : ''}${diff}</span></td>`}
              ${f.type === 'receipt' && html`<td class="right">${readOnly ? (l.unit_cost !== '' ? fmt.money(l.unit_cost) : '—') : html`<input class="input sm" type="number" min="0" step="0.01" style="width:100px;text-align:right" value=${l.unit_cost} onInput=${(e) => setLine(i, 'unit_cost', e.currentTarget.value)} />`}</td>
                <td class="right">${fmt.money((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}</td>`}
              <td>${readOnly ? html`<span class="small">${l.note}</span>` : html`<input class="input sm" value=${l.note} onInput=${(e) => setLine(i, 'note', e.currentTarget.value)} />`}</td>
              ${!readOnly && html`<td><${Button} size="sm" variant="ghost" icon="close" onClick=${() => setF((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))} /></td>`}
            </tr>`;
          })}</tbody>
        </table></div>
        <div class="card-body row" style="border-top:1px solid var(--border);justify-content:flex-end;gap:24px">
          <span>Cəmi miqdar: <b>${totalQty}</b></span>
          ${f.type === 'receipt' && html`<span>Cəmi maya dəyəri: <b>${fmt.money(totalCost)}</b></span>`}
        </div>`}
      </${Card}>
    </div>
  </div>`;
}

// --------------------------------------------------------------- movements
export function Movements({ query }) {
  const page = Number(query.page) || 1;
  const wh = useWarehouses();
  const { data, loading, error, reload } = useAsync(() => api.get('/inventory/movements', { ...query, page }), [JSON.stringify(query)]);
  return html`<div>
    <${PageHeader} title="Stok hərəkətləri" subtitle="Anbardakı hər dəyişikliyin dəyişməz jurnalı" />
    <div class="card">
      <div class="toolbar">
        <${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} placeholder="Məhsul, SKU, qeyd…" />
        <${Select} value=${query.type} onChange=${(v) => setQuery({ type: v, page: '' })} placeholder="Növ: hamısı" options=${[
          { value: 'receipt', label: 'Mədaxil' }, { value: 'issue', label: 'Məxaric' }, { value: 'sale', label: 'Satış' }, { value: 'return', label: 'Qaytarma' },
          { value: 'transfer_in', label: 'Transfer (giriş)' }, { value: 'transfer_out', label: 'Transfer (çıxış)' }, { value: 'adjustment', label: 'İnventarizasiya' },
        ]} />
        <${Select} value=${query.warehouse_id} onChange=${(v) => setQuery({ warehouse_id: v, page: '' })} placeholder="Bütün anbarlar" options=${(wh.data || []).map((w) => ({ value: w.id, label: w.name }))} />
        <input class="input" type="date" style="width:auto" value=${query.from || ''} onChange=${(e) => setQuery({ from: e.currentTarget.value, page: '' })} />
        <input class="input" type="date" style="width:auto" value=${query.to || ''} onChange=${(e) => setQuery({ to: e.currentTarget.value, page: '' })} />
        ${query.variant_id && html`<span class="chip">Variant #${query.variant_id}<button onClick=${() => setQuery({ variant_id: '' })}><${Icon} name="close" cls="sm" /></button></span>`}
      </div>
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length
        ? html`<${Empty} icon="swap_vert" title="Hərəkət yoxdur" />`
        : html`<div class="table-wrap"><table class="table">
          <thead><tr><th>Tarix</th><th>Növ</th><th>Məhsul</th><th>Anbar</th><th class="right">Dəyişmə</th><th class="right">Qalıq</th><th>Mənbə</th><th>İstifadəçi</th></tr></thead>
          <tbody>${data.items.map((m) => html`<tr>
            <td class="small nowrap">${fmt.datetime(m.created_at)}</td>
            <td><${Badge} color=${MOVE_COLORS[m.type]}>${m.type_label}</${Badge}></td>
            <td><div class="name">${m.product_name}</div><div class="sub"><span class="mono">${m.sku}</span> · ${[m.color_name || m.color, m.size].filter(Boolean).join(' / ')}</div></td>
            <td>${m.warehouse_name}</td>
            <td class="right"><span class="qty ${m.quantity < 0 ? 'neg' : ''}" style=${m.quantity > 0 ? 'color:var(--success)' : ''}>${m.quantity > 0 ? '+' : ''}${m.quantity}</span></td>
            <td class="right"><b>${m.balance_after}</b></td>
            <td class="small">${m.document_id ? html`<a class="mono" href=${`#/inventory/documents/${m.document_id}`}>${m.doc_no}</a>` : m.order_id ? html`<a href=${`#/orders/${m.order_id}`}>Sifariş #${m.order_id}</a>` : '—'}
              ${m.note && html`<div class="sub">${m.note}</div>`}</td>
            <td class="small">${m.username || 'sistem'}</td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
  </div>`;
}

// -------------------------------------------------------------- warehouses
function WarehouseModal({ item, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ code: '', name: '', address: '', is_active: true, is_default: false, ...item }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    await attempt(() => (item?.id ? api.put(`/inventory/warehouses/${item.id}`, f) : api.post('/inventory/warehouses', f)), 'Anbar yadda saxlanıldı');
    onSaved();
  }
  return html`<${Modal} title=${item?.id ? f.name : 'Yeni anbar'} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" onClick=${save}>Yadda saxla</${Button}>`}>
    <div class="stack">
      <div class="form-grid">
        <${Field} label="Kod" required><${Input} className="mono" value=${f.code} onInput=${(v) => set('code', v.toUpperCase())} placeholder="ANB-02" /></${Field}>
        <${Field} label="Ad" required><${Input} value=${f.name} onInput=${(v) => set('name', v)} placeholder="Gənclik mağazası" /></${Field}>
      </div>
      <${Field} label="Ünvan"><${Input} value=${f.address} onInput=${(v) => set('address', v)} /></${Field}>
      <${Switch} checked=${f.is_default} onChange=${(v) => set('is_default', v)} label="Əsas anbar" sub="Saytdan gələn sifarişlər ilk növbədə buradan çıxılır." />
      <${Switch} checked=${f.is_active} disabled=${item?.is_default} onChange=${(v) => set('is_active', v)} label="Aktiv" sub="Deaktiv anbarın qalığı saytda nəzərə alınmır." />
    </div>
  </${Modal}>`;
}

export function Warehouses() {
  const { data, loading, error, reload } = useWarehouses();
  const [edit, setEdit] = useState(null);
  async function remove(w) {
    if (!(await confirmDialog({ title: 'Anbarı silmək', message: `“${w.name}” silinsin?`, confirmText: 'Sil', danger: true }))) return;
    await attempt(() => api.del(`/inventory/warehouses/${w.id}`), 'Silindi');
    reload();
  }
  return html`<div>
    <${PageHeader} title="Anbarlar" subtitle="Mağazalar, depolar və saxlama yerləri">
      <${Button} variant="primary" icon="add" onClick=${() => setEdit({})}>Yeni anbar</${Button}>
    </${PageHeader}>
    <div class="card">
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading ? html`<${Loading} />` : html`
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Kod</th><th>Ad</th><th>Ünvan</th><th class="right">Ədəd</th><th class="right">SKU</th><th>Status</th><th></th></tr></thead>
          <tbody>${data.map((w) => html`<tr class="click" onClick=${() => setEdit(w)}>
            <td class="mono"><b>${w.code}</b></td>
            <td class="name">${w.name} ${w.is_default && html`<${Badge} color="green">Əsas</${Badge}>`}</td>
            <td class="small">${w.address}</td>
            <td class="right">${fmt.num(w.units)}</td>
            <td class="right">${w.sku_count}</td>
            <td>${w.is_active ? html`<${Badge} color="green">Aktiv</${Badge}>` : html`<${Badge}>Deaktiv</${Badge}>`}</td>
            <td onClick=${(e) => e.stopPropagation()}>${!w.is_default && html`<${Button} size="sm" variant="ghost" icon="delete" onClick=${() => remove(w)} />`}</td>
          </tr>`)}</tbody>
        </table></div>`}
    </div>
    ${edit && html`<${WarehouseModal} item=${edit.id ? edit : null} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); reload(); }} />`}
  </div>`;
}

// --------------------------------------------------------------- suppliers
function SupplierModal({ item, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ name: '', contact_person: '', phone: '', email: '', address: '', tax_id: '', note: '', is_active: true, ...item }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    await attempt(() => (item?.id ? api.put(`/inventory/suppliers/${item.id}`, f) : api.post('/inventory/suppliers', f)), 'Təchizatçı yadda saxlanıldı');
    onSaved();
  }
  return html`<${Modal} title=${item?.id ? f.name : 'Yeni təchizatçı'} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" onClick=${save}>Yadda saxla</${Button}>`}>
    <div class="form-grid">
      <${Field} label="Şirkət adı" required className="full"><${Input} value=${f.name} onInput=${(v) => set('name', v)} /></${Field}>
      <${Field} label="Əlaqə şəxsi"><${Input} value=${f.contact_person} onInput=${(v) => set('contact_person', v)} /></${Field}>
      <${Field} label="VÖEN"><${Input} value=${f.tax_id} onInput=${(v) => set('tax_id', v)} /></${Field}>
      <${Field} label="Telefon"><${Input} value=${f.phone} onInput=${(v) => set('phone', v)} /></${Field}>
      <${Field} label="E-poçt"><${Input} value=${f.email} onInput=${(v) => set('email', v)} /></${Field}>
      <${Field} label="Ünvan" className="full"><${Input} value=${f.address} onInput=${(v) => set('address', v)} /></${Field}>
      <${Field} label="Qeyd" className="full"><${Textarea} rows="2" value=${f.note} onInput=${(v) => set('note', v)} /></${Field}>
      <div class="full"><${Switch} checked=${f.is_active} onChange=${(v) => set('is_active', v)} label="Aktiv" /></div>
    </div>
  </${Modal}>`;
}

export function Suppliers() {
  const { data, loading, error, reload } = useAsync(() => api.get('/inventory/suppliers'), []);
  const [edit, setEdit] = useState(null);
  async function remove(s) {
    if (!(await confirmDialog({ title: 'Təchizatçını silmək', message: `“${s.name}” silinsin? Sənədlərdəki əlaqə boşalacaq.`, confirmText: 'Sil', danger: true }))) return;
    await attempt(() => api.del(`/inventory/suppliers/${s.id}`), 'Silindi');
    reload();
  }
  return html`<div>
    <${PageHeader} title="Təchizatçılar" subtitle="Mədaxil sənədlərində seçilən tədarükçülər">
      <${Button} variant="primary" icon="add" onClick=${() => setEdit({})}>Yeni təchizatçı</${Button}>
    </${PageHeader}>
    <div class="card">
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading ? html`<${Loading} />` : !data.length ? html`<${Empty} icon="local_shipping" title="Təchizatçı yoxdur" />` : html`
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Ad</th><th>Əlaqə</th><th>VÖEN</th><th class="right">Sənəd</th><th>Status</th><th></th></tr></thead>
          <tbody>${data.map((s) => html`<tr class="click" onClick=${() => setEdit(s)}>
            <td class="name">${s.name}</td>
            <td class="small">${s.contact_person}${s.phone && html`<div>${s.phone}</div>`}${s.email && html`<div>${s.email}</div>`}</td>
            <td class="mono small">${s.tax_id || '—'}</td>
            <td class="right">${s.document_count}</td>
            <td>${s.is_active ? html`<${Badge} color="green">Aktiv</${Badge}>` : html`<${Badge}>Deaktiv</${Badge}>`}</td>
            <td onClick=${(e) => e.stopPropagation()}><${Button} size="sm" variant="ghost" icon="delete" onClick=${() => remove(s)} /></td>
          </tr>`)}</tbody>
        </table></div>`}
    </div>
    ${edit && html`<${SupplierModal} item=${edit.id ? edit : null} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); reload(); }} />`}
  </div>`;
}
