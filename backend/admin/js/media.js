// Media library: grid, uploader, picker modal and media form fields.
import { useState, useRef, useEffect } from 'preact/hooks';
import { html, api, fmt, toast, useAsync, attempt, confirmDialog } from './lib.js';
import { Icon, Button, Modal, Field, Input, Textarea, Loading, Empty, Badge, Alert } from './ui.js';

export function bestUrl(m, size = 'small') {
  if (!m) return '';
  const order = ['thumb', 'small', 'medium', 'large'];
  const f = m.formats || {};
  for (let i = order.indexOf(size); i < order.length; i++) if (f[order[i]]) return f[order[i]].url;
  return m.url;
}

export function Uploader({ onUploaded, accept = 'image/*,video/mp4,video/webm', compact }) {
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const input = useRef();
  async function upload(files) {
    if (!files || !files.length) return;
    setProgress(0);
    try {
      const res = await api.upload(files, setProgress);
      (res.errors || []).forEach((e) => toast.error(`${e.file}: ${e.message}`));
      if (res.items?.length) toast.success(`${res.items.length} fayl yükləndi`);
      onUploaded && onUploaded(res.items || []);
    } catch (err) {
      toast.error(err);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }
  return html`<div class="dropzone ${over ? 'over' : ''}" style=${compact ? 'padding:14px' : ''}
      onClick=${() => input.current.click()}
      onDragOver=${(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave=${() => setOver(false)}
      onDrop=${(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
    <input ref=${input} type="file" multiple accept=${accept} hidden onChange=${(e) => upload(e.currentTarget.files)} />
    ${progress === null
      ? html`<${Icon} name="cloud_upload" /><div><b>Faylları buraya atın</b> və ya klikləyib seçin</div>
          <div class="small">JPG, PNG, WebP, AVIF, GIF (15 MB-a qədər) · MP4/WebM video. Şəkillər avtomatik WebP ölçülərinə çevrilir.</div>`
      : html`<div style="max-width:320px;margin:0 auto"><div class="small" style="margin-bottom:6px">Yüklənir… ${progress}%</div><div class="progress"><div style=${`width:${progress}%`}></div></div></div>`}
  </div>`;
}

function MediaTile({ m, selected, onClick }) {
  const img = m.kind === 'image' ? bestUrl(m, 'thumb') : '';
  return html`<div class="media-tile ${selected ? 'on' : ''}" onClick=${onClick} title=${m.original_name}>
    <div class="img" style=${img ? `background-image:url('${img}')` : ''}>${m.kind === 'video' && html`<${Icon} name="movie" cls="lg" />`}</div>
    ${m.kind === 'image' && !m.alt && html`<span class="flag"><${Badge} color="amber">alt yoxdur</${Badge}></span>`}
    ${selected && html`<span class="tick"><${Icon} name="check" cls="sm" /></span>`}
    <div class="meta"><b>${m.original_name}</b><span class="muted">${m.width ? `${m.width}×${m.height} · ` : ''}${fmt.bytes(m.size)}</span></div>
  </div>`;
}

// Edit alt/title/caption; shows renditions and where the file is used.
export function MediaDetails({ id, onClose, onChanged, onDeleted }) {
  const { data, loading, error } = useAsync(() => api.get(`/media/${id}`), [id]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const m = data;
  useEffect(() => { if (m) setForm({ alt: m.alt, title: m.title, caption: m.caption }); }, [m]);
  const usage = m?.usage;
  const usedIn = usage ? [...usage.products.map((p) => `Məhsul: ${p.name}`), ...usage.categories.map((c) => `Kateqoriya: ${c.name}`), ...usage.posts.map((p) => `Yazı: ${p.name}`), ...usage.settings.map((s) => `Tənzimləmə: ${s}`)] : [];

  async function save() {
    setSaving(true);
    try {
      const r = await attempt(() => api.put(`/media/${id}`, form), 'Yadda saxlanıldı');
      onChanged && onChanged(r);
    } finally { setSaving(false); }
  }
  async function remove() {
    const ok = await confirmDialog({
      title: 'Faylı silmək',
      message: usedIn.length ? `Bu fayl ${usedIn.length} yerdə istifadə olunur. Silinsə, həmin yerlərdə şəkil görünməyəcək. Davam edilsin?` : 'Fayl və bütün ölçüləri birdəfəlik silinəcək.',
      confirmText: 'Sil', danger: true,
    });
    if (!ok) return;
    await attempt(() => api.del(`/media/${id}${usedIn.length ? '?force=1' : ''}`), 'Fayl silindi');
    onDeleted && onDeleted(id);
  }

  return html`<${Modal} title="Fayl məlumatları" size="lg" onClose=${onClose}
    footer=${m && html`<${Button} variant="danger" icon="delete" onClick=${remove}>Sil</${Button}><span class="grow"></span>
      <${Button} onClick=${onClose}>Bağla</${Button}><${Button} variant="primary" loading=${saving} onClick=${save}>Yadda saxla</${Button}>`}>
    ${loading ? html`<${Loading} />` : error ? html`<${Alert} type="danger">${error.message}</${Alert}>` : form && html`
      <div class="grid grid-2">
        <div>
          ${m.kind === 'image'
            ? html`<img src=${bestUrl(m, 'medium')} alt=${m.alt} style="border-radius:10px;border:1px solid var(--border);width:100%" />`
            : html`<video src=${m.url} controls style="width:100%;border-radius:10px"></video>`}
          <dl class="kv mt small">
            <dt>Fayl</dt><dd>${m.original_name}</dd>
            <dt>Ölçü</dt><dd>${m.width ? `${m.width}×${m.height} px · ` : ''}${fmt.bytes(m.size)}</dd>
            <dt>Yüklənib</dt><dd>${fmt.datetime(m.created_at)}</dd>
            <dt>Orijinal URL</dt><dd><a href=${m.url} target="_blank" class="mono">${m.url}</a></dd>
            ${Object.entries(m.formats || {}).map(([k, f]) => html`<dt>${k}</dt><dd><a href=${f.url} target="_blank" class="mono">${f.width}×${f.height} WebP</a></dd>`)}
          </dl>
        </div>
        <div class="stack">
          ${m.kind === 'image' && html`<${Field} label="Alt mətni (SEO)" help="Şəkildə nə olduğunu qısa təsvir edin. Google Şəkillər və əlçatanlıq üçün vacibdir.">
            <${Input} value=${form.alt} onInput=${(v) => setForm({ ...form, alt: v })} placeholder="Məs: Ağ orqanik pambıq uzunqol körpə bodisi" />
          </${Field}>`}
          <${Field} label="Başlıq"><${Input} value=${form.title} onInput=${(v) => setForm({ ...form, title: v })} /></${Field}>
          <${Field} label="İzah (caption)"><${Textarea} rows="3" value=${form.caption} onInput=${(v) => setForm({ ...form, caption: v })} /></${Field}>
          <div>
            <div class="label">İstifadə olunduğu yerlər</div>
            ${usedIn.length ? html`<ul class="small" style="margin:6px 0 0;padding-left:18px">${usedIn.map((u) => html`<li>${u}</li>`)}</ul>` : html`<div class="small muted mt-sm">Heç yerdə istifadə olunmur.</div>`}
          </div>
        </div>
      </div>`}
  </${Modal}>`;
}

export function MediaLibrary({ selectable, multiple, selected = [], onSelect, kind }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const { data, loading, reload } = useAsync(
    () => api.get('/media', { q, page, per_page: 40, kind: kind || (filter === 'video' ? 'video' : filter === 'image' ? 'image' : ''), unused: filter === 'unused' ? 1 : '', no_alt: filter === 'no_alt' ? 1 : '' }),
    [q, page, filter, kind],
  );
  const ids = selected.map((s) => s.id);
  const toggle = (m) => {
    if (!selectable) return setDetail(m.id);
    if (multiple) onSelect(ids.includes(m.id) ? selected.filter((s) => s.id !== m.id) : [...selected, m]);
    else onSelect([m]);
  };
  return html`<div class="stack">
    <${Uploader} compact=${selectable} accept=${kind === 'image' ? 'image/*' : undefined} onUploaded=${(items) => {
      reload();
      if (selectable && items.length) onSelect(multiple ? [...selected, ...items] : [items[0]]);
    }} />
    <div class="row wrap">
      <div class="search grow" style="max-width:340px"><${Icon} name="search" />
        <input class="input" type="search" placeholder="Fayl adı və ya alt mətni…" value=${q} onInput=${(e) => { setPage(1); setQ(e.currentTarget.value); }} />
      </div>
      <select class="select" style="width:auto" value=${filter} onChange=${(e) => { setPage(1); setFilter(e.currentTarget.value); }}>
        <option value="">Hamısı</option>
        ${!kind && html`<option value="image">Şəkillər</option><option value="video">Videolar</option>`}
        <option value="no_alt">Alt mətni olmayanlar</option>
        <option value="unused">İstifadə olunmayanlar</option>
      </select>
      ${data && html`<span class="small muted">${data.total} fayl</span>`}
    </div>
    ${loading && !data ? html`<${Loading} />` : !data?.items.length ? html`<${Empty} icon="photo_library" title="Fayl tapılmadı">Yuxarıdakı sahəyə şəkil yükləyin.</${Empty}>` : html`
      <div class="media-grid">
        ${data.items.map((m) => html`<${MediaTile} key=${m.id} m=${m} selected=${ids.includes(m.id)} onClick=${() => toggle(m)} />`)}
      </div>
      ${data.total > data.per_page && html`<div class="row" style="justify-content:center">
        <${Button} size="sm" icon="chevron_left" disabled=${page <= 1} onClick=${() => setPage(page - 1)} />
        <span class="small">${page} / ${Math.ceil(data.total / data.per_page)}</span>
        <${Button} size="sm" icon="chevron_right" disabled=${page * data.per_page >= data.total} onClick=${() => setPage(page + 1)} />
      </div>`}`}
    ${detail && html`<${MediaDetails} id=${detail} onClose=${() => setDetail(null)} onChanged=${reload} onDeleted=${() => { setDetail(null); reload(); }} />`}
  </div>`;
}

export function MediaPicker({ multiple, kind, onClose, onPick, initial = [] }) {
  const [sel, setSel] = useState(initial);
  return html`<${Modal} title=${multiple ? 'Şəkilləri seçin' : 'Fayl seçin'} size="xl" onClose=${onClose}
    footer=${html`<span class="small muted grow">${sel.length ? `${sel.length} seçilib` : 'Heç nə seçilməyib'}</span>
      <${Button} onClick=${onClose}>İmtina</${Button}>
      <${Button} variant="primary" disabled=${!sel.length} onClick=${() => onPick(sel)}>Seç</${Button}>`}>
    <${MediaLibrary} selectable multiple=${multiple} kind=${kind} selected=${sel} onSelect=${setSel} />
  </${Modal}>`;
}

/**
 * Single media reference stored as an id (categories, posts) — `value` is the
 * media object (or null), onChange receives the media object.
 */
export function MediaField({ value, onChange, kind = 'image', label = 'Şəkil seç' }) {
  const [open, setOpen] = useState(false);
  const img = value && value.kind !== 'video' ? bestUrl(value, 'small') : '';
  return html`<div class="single-media">
    <div class="preview" style=${img ? `background-image:url('${img}')` : ''}>${!img && html`<${Icon} name=${kind === 'video' ? 'movie' : 'image'} cls="lg" />`}</div>
    <div class="stack" style="gap:6px">
      ${value && html`<div class="small"><b>${value.original_name || value.title || 'Seçilmiş fayl'}</b>${value.kind === 'image' && !value.alt && html` · <span style="color:var(--warn)">alt mətni yoxdur</span>`}</div>`}
      <div class="row">
        <${Button} size="sm" icon="photo_library" onClick=${() => setOpen(true)}>${value ? 'Dəyiş' : label}</${Button}>
        ${value && html`<${Button} size="sm" variant="ghost" icon="close" onClick=${() => onChange(null)}>Sil</${Button}>`}
      </div>
    </div>
    ${open && html`<${MediaPicker} kind=${kind} onClose=${() => setOpen(false)} onPick=${(items) => { onChange(items[0]); setOpen(false); }} />`}
  </div>`;
}

/**
 * URL-valued media (homepage/SEO settings store plain URLs so the storefront
 * can also point at its own static assets).
 */
export function MediaUrlField({ value, onChange, kind = 'image' }) {
  const [open, setOpen] = useState(false);
  const isImg = kind === 'image' && value;
  const src = value && !/^https?:|^\//.test(value) ? `/${value}` : value;
  return html`<div class="single-media">
    <div class="preview" style=${isImg ? `background-image:url('${src}')` : ''}>${!isImg && html`<${Icon} name=${kind === 'video' ? 'movie' : 'image'} cls="lg" />`}</div>
    <div class="stack grow" style="gap:6px">
      <input class="input sm mono" value=${value || ''} placeholder="/uploads/... və ya assets/..." onInput=${(e) => onChange(e.currentTarget.value)} />
      <div class="row">
        <${Button} size="sm" icon="photo_library" onClick=${() => setOpen(true)}>Kitabxanadan seç</${Button}>
        ${value && html`<${Button} size="sm" variant="ghost" onClick=${() => onChange('')}>Təmizlə</${Button}>`}
      </div>
    </div>
    ${open && html`<${MediaPicker} kind=${kind} onClose=${() => setOpen(false)} onPick=${(items) => {
      const m = items[0];
      onChange(m.kind === 'image' ? bestUrl(m, 'large') : m.url);
      setOpen(false);
    }} />`}
  </div>`;
}

// Ordered product gallery; first image is the cover.
export function GalleryField({ value = [], onChange, colors = [] }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const move = (i, d) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return html`<div class="stack">
    <div class="gallery">
      ${value.map((m, i) => html`<div class="gallery-item" key=${m.id}>
        <img src=${bestUrl(m, 'small')} alt=${m.alt} />
        ${i === 0 && html`<span class="cover"><${Badge} color="green">Əsas</${Badge}></span>`}
        ${!m.alt && html`<span class="alt-missing" title="Alt mətni yoxdur"><${Badge} color="amber">alt</${Badge}></span>`}
        <div class="ops">
          <button type="button" title="Sola" onClick=${() => move(i, -1)}><${Icon} name="chevron_left" cls="sm" /></button>
          <button type="button" title="Məlumatlar" onClick=${() => setDetail(m.id)}><${Icon} name="edit" cls="sm" /></button>
          <button type="button" title="Çıxar" onClick=${() => onChange(value.filter((x) => x.id !== m.id))}><${Icon} name="close" cls="sm" /></button>
          <button type="button" title="Sağa" onClick=${() => move(i, 1)}><${Icon} name="chevron_right" cls="sm" /></button>
        </div>
      </div>`)}
      <div class="gallery-add" onClick=${() => setOpen(true)}><div><${Icon} name="add_photo_alternate" cls="lg" /><div>Şəkil əlavə et</div></div></div>
    </div>
    ${colors.length > 1 && value.length > 0 && html`<div class="stack" style="gap:8px">
      <div class="label">Şəklin rəngə aidiyyatı <span class="small muted" style="font-weight:400">(məhsul səhifəsində rəng seçiləndə uyğun şəkil göstərilir)</span></div>
      ${value.map((m, i) => html`<div class="row small">
        <img src=${bestUrl(m, 'thumb')} style="width:32px;height:32px;border-radius:6px;object-fit:cover" alt="" />
        <span class="grow">${i + 1}. ${m.alt || m.original_name || 'Şəkil'}</span>
        <select class="select sm" style="width:170px" value=${m.color || ''} onChange=${(e) => onChange(value.map((x) => (x.id === m.id ? { ...x, color: e.currentTarget.value } : x)))}>
          <option value="">Bütün rənglər</option>
          ${colors.map((c) => html`<option value=${c.slug}>${c.name}</option>`)}
        </select>
      </div>`)}
    </div>`}
    ${open && html`<${MediaPicker} multiple kind="image" onClose=${() => setOpen(false)} onPick=${(items) => {
      const ids = value.map((v) => v.id);
      onChange([...value, ...items.filter((m) => !ids.includes(m.id))]);
      setOpen(false);
    }} />`}
    ${detail && html`<${MediaDetails} id=${detail} onClose=${() => setDetail(null)}
      onChanged=${(m) => onChange(value.map((x) => (x.id === m.id ? { ...x, alt: m.alt, title: m.title } : x)))}
      onDeleted=${(id) => { setDetail(null); onChange(value.filter((x) => x.id !== id)); }} />`}
  </div>`;
}
