import { useState, useEffect } from 'preact/hooks';
import { html, api, fmt, useAsync, setQuery, navigate, attempt, confirmDialog, slugify, stripHtml, useDirtyGuard, can } from '../lib.js';
import {
  Card, PageHeader, Loading, ErrorBox, Icon, Button, Field, Input, NumberInput, Textarea, Select, Switch, Tabs, FilterTabs,
  SearchInput, Pager, Empty, Alert, Badge, statusBadge, ScoreBadge, Thumb, TagInput, Modal, Counter,
} from '../ui.js';
import { GalleryField } from '../media.js';
import { RichText } from '../editor.js';
import { SeoPanel } from '../seo.js';

// ------------------------------------------------------------------ list
export function ProductList({ query }) {
  const page = Number(query.page) || 1;
  const { data, loading, error, reload } = useAsync(() => api.get('/products', { ...query, page, per_page: 25 }), [JSON.stringify(query)]);
  const cats = useAsync(() => api.get('/categories'), []);
  const [selected, setSelected] = useState([]);
  const items = data?.items || [];
  const allOn = items.length > 0 && items.every((p) => selected.includes(p.id));

  async function bulk(action, label) {
    const ok = await confirmDialog({ title: 'Toplu əməliyyat', message: `${selected.length} məhsul üçün “${label}” tətbiq edilsin?` });
    if (!ok) return;
    await attempt(() => api.post('/products/bulk', { ids: selected, action }), 'Yeniləndi');
    setSelected([]);
    reload();
  }

  return html`<div>
    <${PageHeader} title="Məhsullar" subtitle="Kataloqdakı bütün məhsullar, qiymətlər və stok vəziyyəti">
      <${Button} variant="primary" icon="add" onClick=${() => navigate('/products/new')}>Yeni məhsul</${Button}>
    </${PageHeader}>
    <div class="card">
      <${FilterTabs} value=${query.status || ''} onChange=${(v) => setQuery({ status: v, page: '' })} items=${[
        { value: '', label: 'Hamısı' }, { value: 'published', label: 'Dərc olunub' }, { value: 'draft', label: 'Qaralama' }, { value: 'archived', label: 'Arxiv' },
      ]} />
      <div class="toolbar">
        <${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} placeholder="Ad, SKU və ya slug…" />
        <${Select} value=${query.category} onChange=${(v) => setQuery({ category: v, page: '' })} placeholder="Bütün kateqoriyalar"
          options=${(cats.data || []).map((c) => ({ value: c.id, label: c.name }))} />
        <${Select} value=${query.stock} onChange=${(v) => setQuery({ stock: v, page: '' })} placeholder="Stok: hamısı"
          options=${[{ value: 'out', label: 'Stokda yoxdur' }, { value: 'low', label: 'Az qalıb' }, { value: 'untracked', label: 'Stok izlənmir' }]} />
        <${Select} value=${query.sort} onChange=${(v) => setQuery({ sort: v })} placeholder="Sıralama: standart"
          options=${[{ value: 'new', label: 'Ən yenilər' }, { value: 'updated', label: 'Son dəyişənlər' }, { value: 'name', label: 'Ad (A–Z)' }, { value: 'price_asc', label: 'Qiymət ↑' }, { value: 'price_desc', label: 'Qiymət ↓' }, { value: 'stock', label: 'Stok ↑' }, { value: 'sales', label: 'Satış ↓' }]} />
      </div>
      ${selected.length > 0 && html`<div class="bulkbar">
        <span>${selected.length} seçilib</span>
        <${Button} size="sm" onClick=${() => bulk('publish', 'Dərc et')}>Dərc et</${Button}>
        <${Button} size="sm" onClick=${() => bulk('draft', 'Qaralamaya keçir')}>Qaralama</${Button}>
        <${Button} size="sm" onClick=${() => bulk('archive', 'Arxivlə')}>Arxivlə</${Button}>
        <${Button} size="sm" onClick=${() => bulk('track_on', 'Stoku izlə')}>Stoku izlə</${Button}>
        <${Button} size="sm" onClick=${() => bulk('track_off', 'Stok izləməni söndür')}>İzləməni söndür</${Button}>
        <${Button} size="sm" variant="ghost" onClick=${() => setSelected([])}>Ləğv et</${Button}>
      </div>`}
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !items.length
        ? html`<${Empty} icon="checkroom" title="Məhsul tapılmadı">Filtrləri dəyişin və ya yeni məhsul əlavə edin.</${Empty}>`
        : html`<div class="table-wrap"><table class="table">
          <thead><tr>
            <th style="width:36px"><input type="checkbox" class="check" checked=${allOn} onChange=${() => setSelected(allOn ? [] : items.map((p) => p.id))} /></th>
            <th colspan="2">Məhsul</th><th>Kateqoriya</th><th class="right">Qiymət</th><th class="right">Stok</th><th>Status</th><th>SEO</th><th>Yenilənib</th>
          </tr></thead>
          <tbody>${items.map((p) => html`<tr class="click" onClick=${() => navigate(`/products/${p.id}`)}>
            <td onClick=${(e) => e.stopPropagation()}><input type="checkbox" checked=${selected.includes(p.id)}
              onChange=${() => setSelected(selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id])} /></td>
            <td style="width:52px"><${Thumb} src=${p.thumb} /></td>
            <td><div class="name">${p.name}</div><div class="sub mono">${p.sku || p.slug}</div>
              <div class="row" style="gap:4px;margin-top:2px">${p.is_featured && html`<${Badge} color="purple">Seçilmiş</${Badge}>`}${p.is_new && html`<${Badge} color="blue">Yeni</${Badge}>`}</div></td>
            <td>${p.category_name || html`<span class="faint">—</span>`}</td>
            <td class="right nowrap"><b>${fmt.money(p.price)}</b>${p.compare_at_price > p.price && html`<div class="sub" style="text-decoration:line-through">${fmt.money(p.compare_at_price)}</div>`}</td>
            <td class="right nowrap">${p.track_stock
              ? html`<span class="qty ${p.stock <= 0 ? 'neg' : p.stock <= 3 ? 'low' : ''}">${p.stock}</span><div class="sub">${p.variant_count} variant</div>`
              : html`<span class="small faint">izlənmir</span>`}</td>
            <td>${statusBadge(p.status)}</td>
            <td><${ScoreBadge} score=${p.seo_score} /></td>
            <td class="small muted nowrap">${fmt.ago(p.updated_at)}</td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
  </div>`;
}

// ------------------------------------------------------------------ edit
const EMPTY = {
  name: '', slug: '', sku: '', status: 'draft', category_id: '', short_description: '', description: '', material: '100% Orqanik Pambıq',
  price: '', compare_at_price: '', cost_price: '', badge: '', is_new: true, is_featured: false, colors: [], sizes: [], attributes: [],
  track_stock: false, allow_backorder: false, sort_order: 0, seo: {}, images: [], variants: [],
};

function toForm(p) {
  return {
    ...EMPTY,
    ...p,
    category_id: p.category_id || '',
    compare_at_price: p.compare_at_price ?? '',
    cost_price: p.cost_price ?? '',
    sku: p.sku || '',
    seo: p.seo || {},
    attributes: p.attributes || [],
  };
}

function ColorSelect({ colors, value, onChange }) {
  return html`<div class="swatches">
    ${colors.map((c) => {
      const on = value.includes(c.slug);
      return html`<button type="button" class="swatch ${on ? 'on' : ''}" onClick=${() => onChange(on ? value.filter((x) => x !== c.slug) : [...value, c.slug])}>
        <span class="dot" style=${`background:${c.hex};border-color:${c.hex_dark}`}>${on && html`<${Icon} name="check" cls="sm" />`}</span>${c.name}
      </button>`;
    })}
    <a class="btn sm ghost" href="#/colors" target="_blank"><${Icon} name="add" />Yeni rəng</a>
  </div>`;
}

function QuickStock({ variant, warehouses, onClose, onDone }) {
  const [f, setF] = useState({ mode: 'receipt', warehouse_id: warehouses.find((w) => w.is_default)?.id || warehouses[0]?.id, quantity: '', unit_cost: '', note: '' });
  const [busy, setBusy] = useState(false);
  const current = (variant.levels || []).find((l) => l.warehouse_id === Number(f.warehouse_id))?.quantity || 0;
  async function submit() {
    setBusy(true);
    try {
      await attempt(() => api.post('/inventory/quick', { ...f, variant_id: variant.id }), 'Stok yeniləndi');
      onDone();
    } finally { setBusy(false); }
  }
  return html`<${Modal} title=${`Stok əməliyyatı — ${variant.sku}`} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" loading=${busy} onClick=${submit}>Təsdiqlə</${Button}>`}>
    <div class="stack">
      <${Field} label="Əməliyyat">
        <${Select} value=${f.mode} onChange=${(v) => setF({ ...f, mode: v })} options=${[
          { value: 'receipt', label: 'Mədaxil (+) — anbara qəbul' },
          { value: 'issue', label: 'Məxaric (−) — silinmə, zay, daxili istifadə' },
          { value: 'set', label: 'Sayım — dəqiq qalığı təyin et' },
        ]} />
      </${Field}>
      <${Field} label="Anbar" help=${`Hazırkı qalıq: ${current} ədəd`}>
        <${Select} value=${f.warehouse_id} onChange=${(v) => setF({ ...f, warehouse_id: v })} options=${warehouses.filter((w) => w.is_active).map((w) => ({ value: w.id, label: w.name }))} />
      </${Field}>
      <div class="form-grid">
        <${Field} label=${f.mode === 'set' ? 'Sayılmış miqdar' : 'Miqdar'} required><${NumberInput} step="1" min="0" value=${f.quantity} onInput=${(v) => setF({ ...f, quantity: v })} /></${Field}>
        ${f.mode === 'receipt' && html`<${Field} label="Vahid maya dəyəri (₼)"><${NumberInput} value=${f.unit_cost} onInput=${(v) => setF({ ...f, unit_cost: v })} /></${Field}>`}
      </div>
      <${Field} label="Qeyd"><${Input} value=${f.note} onInput=${(v) => setF({ ...f, note: v })} placeholder="Məs: qaimə №123, zay məhsul…" /></${Field}>
      <div class="small muted">Hər əməliyyat avtomatik anbar sənədi kimi qeydə alınır (Sənədlər bölməsində görünür).</div>
    </div>
  </${Modal}>`;
}

function VariantRow({ v, product, warehouses, colorsBySlug, onChanged, onStock }) {
  const [edit, setEdit] = useState(null);
  const c = colorsBySlug[v.color];
  const levels = Object.fromEntries((v.levels || []).map((l) => [l.warehouse_id, l]));
  async function save() {
    await attempt(() => api.put(`/products/${product.id}/variants/${v.id}`, { ...edit, is_active: v.is_active }), 'Variant yeniləndi');
    setEdit(null);
    onChanged();
  }
  return html`<tr style=${v.is_active ? '' : 'opacity:.5'}>
    <td class="nowrap">${c && html`<span class="color-dot" style=${`background:${c.hex}`}></span> `}${c ? c.name : v.color || '—'}${v.size && html` / <b>${v.size}</b>`}
      ${!v.is_active && html` <${Badge}>deaktiv</${Badge}>`}</td>
    <td>${edit ? html`<input class="input sm mono" value=${edit.sku} onInput=${(e) => setEdit({ ...edit, sku: e.currentTarget.value })} />` : html`<span class="mono">${v.sku}</span>`}</td>
    <td>${edit ? html`<input class="input sm" value=${edit.barcode} onInput=${(e) => setEdit({ ...edit, barcode: e.currentTarget.value })} placeholder="EAN" />` : html`<span class="small">${v.barcode || '—'}</span>`}</td>
    <td>${edit ? html`<input class="input sm" type="number" step="0.01" value=${edit.price_override ?? ''} onInput=${(e) => setEdit({ ...edit, price_override: e.currentTarget.value })} placeholder=${product.price} />`
      : v.price_override != null ? html`<b>${fmt.money(v.price_override)}</b>` : html`<span class="faint small">əsas</span>`}</td>
    ${warehouses.map((w) => {
      const q = levels[w.id]?.quantity || 0;
      return html`<td class="right"><span class="qty ${q < 0 ? 'neg' : q === 0 ? 'zero' : q <= 3 ? 'low' : ''}">${q}</span></td>`;
    })}
    <td class="right"><b>${v.quantity}</b></td>
    <td><div class="cell-actions">
      ${edit
        ? html`<${Button} size="sm" variant="primary" onClick=${save}>Saxla</${Button}><${Button} size="sm" variant="ghost" onClick=${() => setEdit(null)}>Ləğv</${Button}>`
        : html`<${Button} size="sm" icon="edit" title="Redaktə" onClick=${() => setEdit({ sku: v.sku, barcode: v.barcode, price_override: v.price_override })} />
          ${v.is_active && can('inventory') && html`<${Button} size="sm" icon="add_box" title="Stok əməliyyatı" onClick=${() => onStock(v)} />`}
          <a class="btn sm icon" title="Hərəkətlər" href=${`#/inventory/movements?variant_id=${v.id}`}><${Icon} name="history" /></a>`}
    </div></td>
  </tr>`;
}

function VariantsTab({ form, set, product, warehouses, colors, reload, dirtyVariants }) {
  const [stockFor, setStockFor] = useState(null);
  const colorsBySlug = Object.fromEntries(colors.map((c) => [c.slug, c]));
  const active = (product?.variants || []).filter((v) => v.is_active);
  const total = active.reduce((s, v) => s + v.quantity, 0);
  return html`<div class="stack">
    <${Card} title="Stok idarəsi" icon="inventory_2">
      <div class="stack">
        <${Switch} checked=${form.track_stock} onChange=${(v) => set('track_stock', v)} label="Stoku izlə"
          sub="Aktiv olduqda saytda yalnız anbarda olan rəng/ölçülər satılır, sifarişlər stoku avtomatik azaldır, ləğv edilən sifarişlər geri qaytarır." />
        <${Switch} checked=${form.allow_backorder} disabled=${!form.track_stock} onChange=${(v) => set('allow_backorder', v)} label="Stok bitəndə də sifariş qəbul et"
          sub="Öncədən sifariş: qalıq mənfiyə düşə bilər." />
        ${form.track_stock && product && !total && html`<${Alert} type="warn">Bu məhsulun anbarda qalığı yoxdur — stok izlənərsə saytda “stokda yoxdur” görünəcək. Aşağıdan mədaxil edin.</${Alert}>`}
      </div>
    </${Card}>
    <${Card} title=${`Variantlar (${active.length})`} icon="view_module" bodyClass=""
      actions=${product && can('inventory') && html`<a class="btn sm" href=${`#/inventory/documents/new?type=receipt&product_id=${product.id}`}><${Icon} name="input" />Toplu mədaxil</a>`}>
      ${!product ? html`<div class="card-body"><${Alert}>Variantlar məhsul yadda saxlandıqdan sonra rəng × ölçü kombinasiyalarından avtomatik yaranır.</${Alert}></div>` : html`
        ${dirtyVariants && html`<div class="card-body" style="padding-bottom:0"><${Alert} type="info">Rəng və ya ölçü dəyişdi — variantlar yadda saxladıqdan sonra yenilənəcək.</${Alert}></div>`}
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Variant</th><th>SKU</th><th>Barkod</th><th>Qiymət</th>${warehouses.map((w) => html`<th class="right">${w.name}</th>`)}<th class="right">Cəmi</th><th></th></tr></thead>
          <tbody>${(product.variants || []).map((v) => html`<${VariantRow} key=${v.id} v=${v} product=${product} warehouses=${warehouses} colorsBySlug=${colorsBySlug} onChanged=${reload} onStock=${setStockFor} />`)}</tbody>
        </table></div>`}
    </${Card}>
    ${stockFor && html`<${QuickStock} variant=${stockFor} warehouses=${warehouses} onClose=${() => setStockFor(null)} onDone=${() => { setStockFor(null); reload(); }} />`}
  </div>`;
}

export function ProductEdit({ params, query }) {
  const isNew = params.id === 'new';
  // Tab lives in the URL so dashboard/SEO links can deep-link (?tab=seo).
  const tab = query.tab || 'main';
  const setTab = (t) => setQuery({ tab: t === 'main' ? '' : t });
  const meta = useAsync(() => Promise.all([
    api.get('/categories'),
    api.get('/colors'),
    api.get('/api/v1/settings').catch(() => ({})),
    can('inventory') ? api.get('/inventory/warehouses') : Promise.resolve([{ id: 1, name: 'Anbar', is_active: true, is_default: true }]),
    can('seo') ? api.get('/settings/seo').then((r) => r.value).catch(() => ({})) : Promise.resolve({}),
  ]), []);
  const prod = useAsync(() => (isNew ? Promise.resolve(null) : api.get(`/products/${params.id}`)), [params.id]);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) {
      const f = toForm(EMPTY);
      setForm(f);
      setSaved(JSON.stringify(f));
    } else if (prod.data) {
      const f = toForm(prod.data);
      setForm(f);
      setSaved(JSON.stringify(f));
    }
  }, [prod.data, isNew]);

  const dirty = form && JSON.stringify(form) !== saved;
  useDirtyGuard(dirty);

  if (meta.error || prod.error) return html`<${ErrorBox} error=${meta.error || prod.error} onRetry=${() => { meta.reload(); prod.reload(); }} />`;
  if (!form || !meta.data) return html`<${Loading} />`;
  const [categories, colors, store, warehousesAll, seoSettings] = meta.data;
  const warehouses = warehousesAll.filter((w) => w.is_active);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const product = prod.data;
  const savedForm = JSON.parse(saved);
  const dirtyVariants = JSON.stringify(form.colors) !== JSON.stringify(savedForm.colors) || JSON.stringify(form.sizes) !== JSON.stringify(savedForm.sizes);

  const margin = form.cost_price && form.price ? Math.round(((form.price - form.cost_price) / form.price) * 100) : null;
  const discount = form.compare_at_price && Number(form.compare_at_price) > Number(form.price) ? Math.round((1 - form.price / form.compare_at_price) * 100) : 0;
  const tpl = seoSettings.product_title_template || '%s — 100% Orqanik Pambıq | Bodi.az';
  const autoTitle = tpl.replace('%s', form.name || 'Məhsul');
  const autoDesc = `${form.name} — ${form.material}. ${form.short_description || stripHtml(form.description)}`.slice(0, 158);

  async function save(nextStatus) {
    const body = {
      ...form,
      status: nextStatus || form.status,
      slug: form.slug || slugify(form.name),
      images: form.images.map((m) => ({ media_id: m.id, color: m.color || '' })),
    };
    setBusy(true);
    try {
      const r = await attempt(() => (isNew ? api.post('/products', body) : api.put(`/products/${params.id}`, body)), 'Məhsul yadda saxlanıldı');
      const f = toForm(r);
      setForm(f);
      setSaved(JSON.stringify(f));
      if (isNew) navigate(`/products/${r.id}`, { replace: true });
      else prod.setData(r);
    } finally { setBusy(false); }
  }
  async function remove() {
    const ok = await confirmDialog({ title: 'Məhsulu silmək', message: `“${form.name}” birdəfəlik silinsin? Sifariş və ya anbar tarixçəsi olan məhsullar silinmir — onları arxivləyin.`, confirmText: 'Sil', danger: true });
    if (!ok) return;
    await attempt(() => api.del(`/products/${params.id}`), 'Məhsul silindi');
    navigate('/products');
  }
  async function duplicate() {
    const r = await attempt(() => api.post(`/products/${params.id}/duplicate`), 'Kopya yaradıldı (qaralama)');
    navigate(`/products/${r.id}`);
  }

  const seoFlag = !form.seo?.description && !form.short_description ? 'Meta təsvir yoxdur' : '';
  const imgFlag = !form.images.length ? 'Şəkil yoxdur' : form.images.some((m) => !m.alt) ? 'Alt mətni olmayan şəkil var' : '';

  return html`<div>
    <${PageHeader} title=${isNew ? 'Yeni məhsul' : form.name || 'Məhsul'} subtitle=${!isNew && html`<span class="mono">/product.html?p=${product?.slug}</span>`}>
      ${!isNew && form.status === 'published' && html`<a class="btn" href=${`/product.html?p=${product.slug}`} target="_blank"><${Icon} name="open_in_new" />Saytda bax</a>`}
      ${!isNew && html`<${Button} icon="content_copy" onClick=${duplicate}>Kopyala</${Button}>`}
      ${dirty && html`<${Badge} color="amber">Yadda saxlanmamış dəyişikliklər</${Badge}>`}
      <${Button} variant="primary" icon="save" loading=${busy} onClick=${() => save()}>Yadda saxla</${Button}>
    </${PageHeader}>
    <${Tabs} value=${tab} onChange=${setTab} items=${[
      { value: 'main', label: 'Əsas məlumatlar', icon: 'edit_note' },
      { value: 'media', label: `Şəkillər (${form.images.length})`, icon: 'photo_library', flag: imgFlag },
      { value: 'variants', label: 'Variantlar və anbar', icon: 'inventory_2' },
      { value: 'seo', label: 'SEO', icon: 'travel_explore', flag: seoFlag },
    ]} />
    <div class="edit-layout">
      <div class="stack">
        ${tab === 'main' && html`
          <${Card}>
            <div class="stack">
              <${Field} label="Məhsulun adı" required counter=${html`<${Counter} value=${form.name} min=${10} max=${70} />`}>
                <${Input} value=${form.name} onInput=${(v) => setForm((f) => ({ ...f, name: v, slug: isNew && (!f.slug || f.slug === slugify(f.name)) ? slugify(v) : f.slug }))} placeholder="Məs: Ağ Pambıq Uzunqol Bodi" />
              </${Field}>
              <${Field} label="URL (slug)" help=${!isNew && product && form.slug !== product.slug ? 'Köhnə ünvan avtomatik yeni ünvana yönləndiriləcək (301).' : 'Yalnız latın hərfləri, rəqəm və tire. Azərbaycan hərfləri avtomatik çevrilir.'}>
                <div class="input-group"><span class="addon">product.html?p=</span><${Input} value=${form.slug} onInput=${(v) => set('slug', slugify(v))} /></div>
              </${Field}>
              <${Field} label="Qısa təsvir" help="Məhsul kartlarında və axtarış nəticələrində görünür." counter=${html`<${Counter} value=${form.short_description} min=${50} max=${300} />`}>
                <${Textarea} rows="3" value=${form.short_description} onInput=${(v) => set('short_description', v)} />
              </${Field}>
              <${Field} label="Ətraflı təsvir"><${RichText} value=${form.description} onChange=${(v) => set('description', v)} /></${Field}>
            </div>
          </${Card}>
          <${Card} title="Qiymət" icon="payments">
            <div class="grid grid-3">
              <${Field} label="Satış qiyməti" required><div class="input-group"><${NumberInput} value=${form.price} onInput=${(v) => set('price', v)} /><span class="addon">₼</span></div></${Field}>
              <${Field} label="Köhnə qiymət" help=${discount ? `Saytda “-${discount}%” endirim nişanı görünəcək.` : 'Endirim üçün satış qiymətindən böyük yazın.'}>
                <div class="input-group"><${NumberInput} value=${form.compare_at_price} onInput=${(v) => set('compare_at_price', v)} /><span class="addon">₼</span></div>
              </${Field}>
              <${Field} label="Maya dəyəri" help=${margin !== null ? `Marja: ${margin}%` : 'Yalnız admin paneldə görünür. Mədaxildə avtomatik yenilənir.'}>
                <div class="input-group"><${NumberInput} value=${form.cost_price} onInput=${(v) => set('cost_price', v)} /><span class="addon">₼</span></div>
              </${Field}>
            </div>
          </${Card}>
          <${Card} title="Xüsusiyyətlər" icon="style">
            <div class="stack">
              <${Field} label="Rənglər" help="Saytda rəng seçimləri və filtr üçün."><${ColorSelect} colors=${colors} value=${form.colors} onChange=${(v) => set('colors', v)} /></${Field}>
              <${Field} label="Ölçülər"><${TagInput} value=${form.sizes} onChange=${(v) => set('sizes', v)} suggestions=${store.sizes || []} placeholder="0-3 ay, 3-6 ay…" /></${Field}>
              <${Field} label="Material"><${Input} value=${form.material} onInput=${(v) => set('material', v)} /></${Field}>
              <div>
                <div class="label" style="margin-bottom:8px">Əlavə xüsusiyyətlər</div>
                <div class="stack" style="gap:8px">
                  ${form.attributes.map((a, i) => html`<div class="row">
                    <input class="input" style="max-width:220px" value=${a.name} placeholder="Ad (məs: Mövsüm)" onInput=${(e) => set('attributes', form.attributes.map((x, j) => (j === i ? { ...x, name: e.currentTarget.value } : x)))} />
                    <input class="input grow" value=${a.value} placeholder="Dəyər (məs: Dörd fəsil)" onInput=${(e) => set('attributes', form.attributes.map((x, j) => (j === i ? { ...x, value: e.currentTarget.value } : x)))} />
                    <${Button} variant="ghost" icon="delete" onClick=${() => set('attributes', form.attributes.filter((_, j) => j !== i))} />
                  </div>`)}
                  <div><${Button} size="sm" icon="add" onClick=${() => set('attributes', [...form.attributes, { name: '', value: '' }])}>Xüsusiyyət əlavə et</${Button}></div>
                </div>
              </div>
            </div>
          </${Card}>`}
        ${tab === 'media' && html`<${Card} title="Məhsul şəkilləri" icon="photo_library">
          <div class="stack">
            <div class="small muted">İlk şəkil əsas şəkildir (kartlarda və paylaşımlarda). Hər şəklə <b>alt mətni</b> yazın — Google Şəkillər üçün vacibdir. Şəkillər avtomatik WebP-yə çevrilir və ölçülənir.</div>
            <${GalleryField} value=${form.images} onChange=${(v) => set('images', v)} colors=${colors.filter((c) => form.colors.includes(c.slug))} />
          </div>
        </${Card}>`}
        ${tab === 'variants' && html`<${VariantsTab} form=${form} set=${set} product=${product} warehouses=${warehouses} colors=${colors} reload=${prod.reload} dirtyVariants=${dirtyVariants} />`}
        ${tab === 'seo' && html`<${SeoPanel} value=${form.seo} onChange=${(v) => set('seo', v)} auto=${{ title: autoTitle, description: autoDesc }}
          slug=${form.slug} path="product.html?p=" content=${`${form.short_description} ${form.description}`} images=${form.images} kind="product" />`}
      </div>
      <div class="side">
        <${Card} title="Dərc" icon="public">
          <div class="stack">
            <${Field} label="Status">
              <${Select} value=${form.status} onChange=${(v) => set('status', v)} options=${[
                { value: 'draft', label: 'Qaralama (saytda görünmür)' }, { value: 'published', label: 'Dərc olunub' }, { value: 'archived', label: 'Arxiv (satışdan çıxarılıb)' },
              ]} />
            </${Field}>
            ${product?.published_at && html`<div class="small muted">Dərc tarixi: ${fmt.datetime(product.published_at)}</div>`}
            ${product && html`<div class="small muted">Son dəyişiklik: ${fmt.datetime(product.updated_at)}</div>`}
            ${form.status !== 'published' && html`<${Button} variant="primary" icon="publish" loading=${busy} onClick=${() => save('published')}>Yadda saxla və dərc et</${Button}>`}
          </div>
        </${Card}>
        <${Card} title="Təşkil" icon="folder">
          <div class="stack">
            <${Field} label="Kateqoriya">
              <${Select} value=${form.category_id} onChange=${(v) => set('category_id', v)} placeholder="— Seçilməyib —" options=${categories.map((c) => ({ value: c.id, label: c.name }))} />
            </${Field}>
            <${Field} label="SKU (artikul)" help="Variant SKU-ları bundan yaranır."><${Input} className="mono" value=${form.sku} onInput=${(v) => set('sku', v.toUpperCase())} placeholder=${slugify(form.name).toUpperCase()} /></${Field}>
            <${Field} label="Nişan (badge)" help="Boşdursa endirim faizi və ya “Yeni” avtomatik göstərilir."><${Input} value=${form.badge} onInput=${(v) => set('badge', v)} placeholder="Məs: Hit, Limitli" maxLength="30" /></${Field}>
            <${Switch} checked=${form.is_new} onChange=${(v) => set('is_new', v)} label="Yeni məhsul" sub="“Yeni gələnlər” bölməsində göstərilir." />
            <${Switch} checked=${form.is_featured} onChange=${(v) => set('is_featured', v)} label="Seçilmiş məhsul" />
            <${Field} label="Sıra nömrəsi" help="Kiçik rəqəm əvvəl göstərilir."><${NumberInput} step="1" value=${form.sort_order} onInput=${(v) => set('sort_order', v)} /></${Field}>
          </div>
        </${Card}>
        ${product && html`<${Card} title="Statistika" icon="monitoring">
          <dl class="kv small">
            <dt>Satılıb</dt><dd>${product.sales_count} ədəd</dd>
            <dt>Reytinq</dt><dd>${product.rating_count ? `${Number(product.rating_avg).toFixed(1)} ★ (${product.rating_count} rəy)` : 'Rəy yoxdur'}</dd>
            ${product.old_slugs?.length > 0 && html`<dt>Köhnə URL-lər</dt><dd class="mono">${product.old_slugs.join(', ')}</dd>`}
          </dl>
        </${Card}>`}
        ${!isNew && html`<${Button} variant="danger" icon="delete" onClick=${remove}>Məhsulu sil</${Button}>`}
      </div>
    </div>
  </div>`;
}

