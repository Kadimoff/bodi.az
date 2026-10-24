import { useState } from 'preact/hooks';
import { html, api, useAsync, attempt, confirmDialog, slugify } from '../lib.js';
import { PageHeader, Loading, ErrorBox, Icon, Button, Field, Input, NumberInput, Textarea, Select, Switch, Modal, Empty, Badge, Tabs } from '../ui.js';
import { MediaField } from '../media.js';
import { SeoPanel } from '../seo.js';

// ------------------------------------------------------------ categories
function CategoryModal({ item, all, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    name: '', slug: '', description: '', parent_id: '', image: null, sort_order: 0, is_active: true, seo: {},
    ...item,
    parent_id: item?.parent_id || '',
  }));
  const [tab, setTab] = useState('main');
  const [busy, setBusy] = useState(false);
  const isNew = !item?.id;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      const body = { ...f, image_id: f.image?.id || null, slug: f.slug || slugify(f.name) };
      await attempt(() => (isNew ? api.post('/categories', body) : api.put(`/categories/${item.id}`, body)), 'Kateqoriya yadda saxlanıldı');
      onSaved();
    } finally { setBusy(false); }
  }
  return html`<${Modal} title=${isNew ? 'Yeni kateqoriya' : f.name} size="lg" onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" loading=${busy} onClick=${save}>Yadda saxla</${Button}>`}>
    <${Tabs} value=${tab} onChange=${setTab} items=${[{ value: 'main', label: 'Əsas' }, { value: 'seo', label: 'SEO' }]} />
    ${tab === 'main' ? html`<div class="stack">
      <div class="form-grid">
        <${Field} label="Ad" required><${Input} value=${f.name} onInput=${(v) => setF((x) => ({ ...x, name: v, slug: isNew && (!x.slug || x.slug === slugify(x.name)) ? slugify(v) : x.slug }))} /></${Field}>
        <${Field} label="URL (slug)"><div class="input-group"><span class="addon">?cat=</span><${Input} value=${f.slug} onInput=${(v) => set('slug', slugify(v))} /></div></${Field}>
        <${Field} label="Üst kateqoriya"><${Select} value=${f.parent_id} onChange=${(v) => set('parent_id', v)} placeholder="— Yoxdur —" options=${all.filter((c) => c.id !== item?.id).map((c) => ({ value: c.id, label: c.name }))} /></${Field}>
        <${Field} label="Sıra"><${NumberInput} step="1" value=${f.sort_order} onInput=${(v) => set('sort_order', v)} /></${Field}>
      </div>
      <${Field} label="Təsvir" help="Kateqoriya səhifəsində və meta təsvirdə istifadə olunur."><${Textarea} rows="3" value=${f.description} onInput=${(v) => set('description', v)} /></${Field}>
      <${Field} label="Şəkil"><${MediaField} value=${f.image} onChange=${(v) => set('image', v)} /></${Field}>
      <${Switch} checked=${f.is_active} onChange=${(v) => set('is_active', v)} label="Aktiv" sub="Deaktiv kateqoriya saytda göstərilmir." />
    </div>` : html`<${SeoPanel} value=${f.seo} onChange=${(v) => set('seo', v)} kind="category" slug=${f.slug} path="category.html?cat="
        auto=${{ title: `${f.name} — Körpə Geyimləri | Bodi.az`, description: f.description || `${f.name} kolleksiyası — Bodi.az-da 100% orqanik pambıqdan körpə geyimləri.` }}
        content=${f.description} images=${f.image ? [f.image] : []} />`}
  </${Modal}>`;
}

export function Categories() {
  const { data, loading, error, reload } = useAsync(() => api.get('/categories'), []);
  const [edit, setEdit] = useState(null);
  async function remove(c) {
    const ok = await confirmDialog({ title: 'Kateqoriyanı silmək', message: `“${c.name}” silinsin? ${c.product_count} məhsul kateqoriyasız qalacaq.`, confirmText: 'Sil', danger: true });
    if (!ok) return;
    await attempt(() => api.del(`/categories/${c.id}`), 'Silindi');
    reload();
  }
  return html`<div>
    <${PageHeader} title="Kateqoriyalar" subtitle="Saytdakı məhsul qrupları və onların SEO məlumatları">
      <${Button} variant="primary" icon="add" onClick=${() => setEdit({})}>Yeni kateqoriya</${Button}>
    </${PageHeader}>
    <div class="card">
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading ? html`<${Loading} />` : !data.length ? html`<${Empty} icon="category" title="Kateqoriya yoxdur" />` : html`
        <div class="table-wrap"><table class="table">
          <thead><tr><th colspan="2">Ad</th><th>URL</th><th class="right">Məhsul</th><th>Status</th><th>SEO</th><th></th></tr></thead>
          <tbody>${data.map((c) => html`<tr class="click" onClick=${() => setEdit(c)}>
            <td style="width:52px">${c.image ? html`<img class="thumb" src=${c.image.formats?.thumb?.url || c.image.url} alt="" />` : html`<div class="thumb" style="display:grid;place-items:center"><${Icon} name="category" cls="sm" /></div>`}</td>
            <td><div class="name">${c.name}</div>${c.parent_id && html`<div class="sub">↳ ${data.find((x) => x.id === c.parent_id)?.name || ''}</div>`}</td>
            <td class="mono small">?cat=${c.slug}</td>
            <td class="right">${c.product_count}</td>
            <td>${c.is_active ? html`<${Badge} color="green">Aktiv</${Badge}>` : html`<${Badge}>Deaktiv</${Badge}>`}</td>
            <td>${c.seo?.title || c.seo?.description ? html`<${Badge} color="green">Fərdi</${Badge}>` : html`<${Badge}>Avtomatik</${Badge}>`}</td>
            <td onClick=${(e) => e.stopPropagation()}><div class="cell-actions">
              <a class="btn sm icon" href=${`/category.html?cat=${c.slug}`} target="_blank" title="Saytda bax"><${Icon} name="open_in_new" /></a>
              <${Button} size="sm" variant="ghost" icon="delete" onClick=${() => remove(c)} />
            </div></td>
          </tr>`)}</tbody>
        </table></div>`}
    </div>
    ${edit && html`<${CategoryModal} item=${edit.id ? edit : null} all=${data || []} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); reload(); }} />`}
  </div>`;
}

// ---------------------------------------------------------------- colours
function ColorModal({ item, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ name: '', slug: '', hex: '#f1ede7', hex_dark: '#ddd0ba', label_color: '#8a7a5c', aliases: '', sort_order: 0, ...item, aliases: (item?.aliases || []).join(', ') }));
  const [busy, setBusy] = useState(false);
  const isNew = !item?.slug;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      await attempt(() => (isNew ? api.post('/colors', { ...f, slug: f.slug || slugify(f.name) }) : api.put(`/colors/${item.slug}`, f)), 'Rəng yadda saxlanıldı');
      onSaved();
    } finally { setBusy(false); }
  }
  // Plain function (not a component) so inputs keep focus between renders.
  const colorInput = (k, label, help) => html`<${Field} label=${label} help=${help}>
    <div class="row"><input type="color" value=${f[k]} onInput=${(e) => set(k, e.currentTarget.value)} style="width:44px;height:38px;border:1px solid var(--border-strong);border-radius:8px;padding:2px;background:#fff" />
    <${Input} className="mono" value=${f[k]} onInput=${(v) => set(k, v)} /></div>
  </${Field}>`;
  return html`<${Modal} title=${isNew ? 'Yeni rəng' : f.name} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" loading=${busy} onClick=${save}>Yadda saxla</${Button}>`}>
    <div class="stack">
      <div class="form-grid">
        <${Field} label="Ad" required><${Input} value=${f.name} onInput=${(v) => set('name', v)} placeholder="Məs: Zümrüd" /></${Field}>
        <${Field} label="Kod (slug)" help=${isNew ? 'Sonradan dəyişmir.' : ''}><${Input} className="mono" value=${isNew ? f.slug || slugify(f.name) : f.slug} disabled=${!isNew} onInput=${(v) => set('slug', slugify(v))} /></${Field}>
        ${colorInput('hex', 'Əsas ton', 'Rəng dairəsi və fon')}
        ${colorInput('hex_dark', 'Tünd ton', 'Qradiyent və kənar xətt')}
        ${colorInput('label_color', 'Mətn rəngi', 'Şəkilsiz məhsul plitəsində yazı')}
        <${Field} label="Sıra"><${NumberInput} step="1" value=${f.sort_order} onInput=${(v) => set('sort_order', v)} /></${Field}>
      </div>
      <${Field} label="Sinonimlər" help="Vergüllə: məs. “yaşıl, green”. Köhnə məlumatlardakı adları bu rəngə uyğunlaşdırır."><${Input} value=${f.aliases} onInput=${(v) => set('aliases', v)} /></${Field}>
      <div class="row">
        <div style=${`width:120px;height:150px;border-radius:12px;background:linear-gradient(${f.hex},${f.hex_dark});display:grid;place-items:end center;padding:10px;color:${f.label_color};font-weight:700`}>${f.name || 'Önizləmə'}</div>
        <span class="swatch on"><span class="dot" style=${`background:${f.hex};border-color:${f.hex_dark}`}></span>${f.name || 'Rəng'}</span>
      </div>
    </div>
  </${Modal}>`;
}

export function Colors() {
  const { data, loading, error, reload } = useAsync(() => api.get('/colors'), []);
  const [edit, setEdit] = useState(null);
  async function remove(c) {
    const ok = await confirmDialog({ title: 'Rəngi silmək', message: `“${c.name}” silinsin?`, confirmText: 'Sil', danger: true });
    if (!ok) return;
    await attempt(() => api.del(`/colors/${c.slug}`), 'Silindi');
    reload();
  }
  return html`<div>
    <${PageHeader} title="Rənglər" subtitle="Məhsul rəng palitrası — saytda rəng seçimi və filtrlər bu siyahıdan qurulur">
      <${Button} variant="primary" icon="add" onClick=${() => setEdit({})}>Yeni rəng</${Button}>
    </${PageHeader}>
    ${error ? html`<${ErrorBox} error=${error} onRetry=${reload} />` : loading ? html`<${Loading} />` : html`<div class="media-grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">
      ${data.map((c) => html`<div class="card" style="overflow:hidden;cursor:pointer" onClick=${() => setEdit(c)}>
        <div style=${`height:90px;background:linear-gradient(135deg,${c.hex},${c.hex_dark})`}></div>
        <div class="card-body" style="padding:10px 12px">
          <div class="row between"><b>${c.name}</b>
            <${Button} size="sm" variant="ghost" icon="delete" onClick=${(e) => { e.stopPropagation(); remove(c); }} disabled=${c.product_count > 0} title=${c.product_count ? 'İstifadə olunur' : 'Sil'} /></div>
          <div class="small muted"><span class="mono">${c.slug}</span> · ${c.product_count} məhsul</div>
        </div>
      </div>`)}
    </div>`}
    ${edit && html`<${ColorModal} item=${edit.slug ? edit : null} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); reload(); }} />`}
  </div>`;
}

