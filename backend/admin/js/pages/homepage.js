// Ana səhifə məzmunu — schema-driven editor for the storefront homepage blocks.
import { useState, useEffect } from 'preact/hooks';
import { html, api, useAsync, attempt, confirmDialog, useDirtyGuard } from '../lib.js';
import { PageHeader, Loading, ErrorBox, Icon, Button, Field, Input, Textarea, Select, Switch, Badge } from '../ui.js';
import { MediaUrlField } from '../media.js';

const ANIMS = [{ value: 'fade-up', label: 'Aşağıdan görünmə' }, { value: 'zoom-in', label: 'Yaxınlaşma' }, { value: 'slide-up', label: 'Sürüşmə' }, { value: 'stagger-up', label: 'Pilləli' }, { value: 'none', label: 'Animasiyasız' }];

const SECTIONS = [
  {
    key: 'hero', title: 'Hero (baş banner)', icon: 'view_carousel',
    fields: [
      ['badge', 'Nişan'], ['title_line1', 'Başlıq — 1-ci sətir'], ['title_highlight', 'Başlıq — vurğulanan hissə'], ['title_line2', 'Başlıq — 2-ci sətir'],
      ['description', 'Təsvir', 'textarea'],
      ['btn_primary_text', 'Əsas düymə mətni'], ['btn_primary_url', 'Əsas düymə linki', 'url'],
      ['btn_secondary_text', 'İkinci düymə mətni'], ['btn_secondary_url', 'İkinci düymə linki', 'url'],
      ['bg_image', 'Fon şəkli', 'image'], ['bg_video', 'Fon videosu', 'video'], ['bg_color', 'Fon rəngi', 'color'],
    ],
  },
  {
    key: 'trust_bar', title: 'Üstünlüklər zolağı', icon: 'verified', list: true,
    item: [['icon', 'İkon', 'icon'], ['title', 'Başlıq'], ['subtitle', 'Alt mətn']],
    blank: { icon: 'star', title: '', subtitle: '' },
  },
  {
    key: 'categories', title: 'Kateqoriyalar bloku', icon: 'category',
    fields: [['eyebrow', 'Üst yazı'], ['title', 'Başlıq']],
    items: { label: 'Kateqoriya kartları', item: [['name', 'Ad'], ['badge', 'Nişan'], ['subtitle', 'Alt mətn'], ['url', 'Link', 'url'], ['image', 'Şəkil', 'image'], ['slug', 'Kateqoriya kodu']], blank: { slug: '', name: '', badge: '', subtitle: '', image: '', url: '' } },
  },
  { key: 'featured_header', title: 'Populyar məhsullar başlığı', icon: 'star', fields: [['eyebrow', 'Üst yazı'], ['title', 'Başlıq']] },
  {
    key: 'promo', title: 'Kampaniya banneri', icon: 'campaign',
    fields: [['badge', 'Nişan'], ['title', 'Başlıq'], ['description', 'Təsvir', 'textarea'], ['btn_text', 'Düymə mətni'], ['btn_url', 'Düymə linki', 'url'], ['image', 'Şəkil', 'image']],
  },
  { key: 'new_header', title: 'Yeni gələnlər başlığı', icon: 'fiber_new', fields: [['eyebrow', 'Üst yazı'], ['title', 'Başlıq']] },
  {
    key: 'values', title: 'Dəyərlərimiz', icon: 'volunteer_activism',
    fields: [['eyebrow', 'Üst yazı'], ['title', 'Başlıq'], ['description', 'Təsvir', 'textarea']],
    items: { label: 'Dəyərlər', item: [['icon', 'İkon', 'icon'], ['title', 'Başlıq'], ['description', 'Təsvir', 'textarea']], blank: { icon: 'spa', title: '', description: '' } },
  },
  { key: 'reviews_header', title: 'Rəylər bloku', icon: 'reviews', fields: [['eyebrow', 'Üst yazı'], ['title', 'Başlıq'], ['description', 'Təsvir', 'textarea'], ['link_text', 'Link mətni'], ['link_url', 'Link', 'url']] },
  {
    key: 'gallery', title: 'İnstagram / Lookbook qalereyası', icon: 'photo_library',
    fields: [['eyebrow', 'Üst yazı'], ['title', 'Başlıq'], ['description', 'Təsvir', 'textarea']],
    items: { label: 'Qalereya şəkilləri', item: [['image', 'Şəkil', 'image'], ['title', 'Başlıq'], ['tag', 'Teq'], ['link', 'Link', 'url'], ['animation', 'Animasiya', 'anim']], blank: { image: '', title: '', tag: '', link: 'https://instagram.com/bodi.az', animation: 'zoom-in' } },
  },
  {
    key: 'animations', title: 'Animasiyalar', icon: 'animation',
    fields: [['hero_style', 'Hero animasiyası', 'anim'], ['sections_style', 'Bölmə animasiyası', 'anim'], ['lumen_shimmer', 'Düymələrdə parıltı', 'bool'],
      ['lumen_speed', 'Parıltı sürəti', 'speed'], ['spark_glint', 'Nişanlarda qığılcım', 'bool']],
  },
];

function FieldInput({ type, value, onChange }) {
  if (type === 'textarea') return html`<${Textarea} rows="2" value=${value} onInput=${onChange} />`;
  if (type === 'image') return html`<${MediaUrlField} value=${value} onChange=${onChange} />`;
  if (type === 'video') return html`<${MediaUrlField} kind="video" value=${value} onChange=${onChange} />`;
  if (type === 'color') return html`<div class="row"><input type="color" value=${value || '#ffffff'} onInput=${(e) => onChange(e.currentTarget.value)} style="width:44px;height:38px;border:1px solid var(--border-strong);border-radius:8px;padding:2px" /><${Input} className="mono" value=${value} onInput=${onChange} /></div>`;
  if (type === 'bool') return html`<${Switch} checked=${value} onChange=${onChange} label=${value ? 'Aktiv' : 'Deaktiv'} />`;
  if (type === 'anim') return html`<${Select} value=${value} onChange=${onChange} options=${ANIMS} />`;
  if (type === 'speed') return html`<${Select} value=${value} onChange=${onChange} options=${[{ value: 'slow', label: 'Yavaş' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Sürətli' }]} />`;
  if (type === 'icon') {
    return html`<div class="row"><span class="btn icon" style="pointer-events:none"><${Icon} name=${value || 'help'} /></span>
      <${Input} className="mono" value=${value} onInput=${onChange} placeholder="local_shipping" /></div>`;
  }
  return html`<${Input} className=${type === 'url' ? 'mono' : ''} value=${value} onInput=${onChange} />`;
}

function FieldsGrid({ fields, value, onChange }) {
  return html`<div class="form-grid">
    ${fields.map(([k, label, type]) => html`<${Field} label=${label} className=${['textarea', 'image', 'video'].includes(type) ? 'full' : ''}
        help=${type === 'icon' ? html`<a href="https://fonts.google.com/icons" target="_blank">Material Symbols</a> adı` : ''}>
      <${FieldInput} type=${type} value=${value?.[k]} onChange=${(v) => onChange({ ...value, [k]: v })} />
    </${Field}>`)}
  </div>`;
}

function Repeater({ label, item, blank, value = [], onChange }) {
  const move = (i, d) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return html`<div class="stack" style="gap:10px">
    ${label && html`<div class="label">${label} <${Badge}>${value.length}</${Badge}></div>`}
    ${value.map((it, i) => html`<div class="repeater-item">
      <div class="row rm" style="gap:2px">
        <${Button} size="sm" variant="ghost" icon="arrow_upward" onClick=${() => move(i, -1)} />
        <${Button} size="sm" variant="ghost" icon="arrow_downward" onClick=${() => move(i, 1)} />
        <${Button} size="sm" variant="ghost" icon="delete" onClick=${() => onChange(value.filter((_, j) => j !== i))} />
      </div>
      <div class="small muted" style="margin-bottom:8px;font-weight:700">#${i + 1}</div>
      <${FieldsGrid} fields=${item} value=${it} onChange=${(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
    </div>`)}
    <div><${Button} size="sm" icon="add" onClick=${() => onChange([...value, { ...blank }])}>Əlavə et</${Button}></div>
  </div>`;
}

export function Homepage() {
  const { data, loading, error, reload } = useAsync(() => api.get('/settings/homepage'), []);
  const [v, setV] = useState(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState('hero');
  useEffect(() => { if (data) { setV(data.value); setSaved(JSON.stringify(data.value)); } }, [data]);
  const dirty = v && JSON.stringify(v) !== saved;
  useDirtyGuard(dirty);
  if (error) return html`<${ErrorBox} error=${error} onRetry=${reload} />`;
  if (loading || !v) return html`<${Loading} />`;

  async function save() {
    setBusy(true);
    try {
      const r = await attempt(() => api.put('/settings/homepage', { value: v }), 'Ana səhifə yeniləndi');
      setV(r.value);
      setSaved(JSON.stringify(r.value));
    } finally { setBusy(false); }
  }
  async function reset() {
    if (!(await confirmDialog({ title: 'Standart məzmuna qaytarmaq', message: 'Ana səhifənin bütün mətn və şəkilləri ilkin dəyərlərə qaytarılsın?', danger: true, confirmText: 'Qaytar' }))) return;
    const r = await attempt(() => api.post('/settings/homepage/reset'), 'Standart məzmun bərpa edildi');
    setV(r.value);
    setSaved(JSON.stringify(r.value));
  }

  return html`<div>
    <${PageHeader} title="Ana səhifə" subtitle="Saytın ana səhifəsindəki mətnlər, şəkillər və bloklar">
      <a class="btn" href="/" target="_blank"><${Icon} name="open_in_new" />Sayta bax</a>
      <${Button} variant="ghost" icon="restart_alt" onClick=${reset}>Standarta qaytar</${Button}>
      ${dirty && html`<${Badge} color="amber">Yadda saxlanmayıb</${Badge}>`}
      <${Button} variant="primary" icon="save" loading=${busy} onClick=${save}>Yadda saxla</${Button}>
    </${PageHeader}>
    <div class="stack">
      ${SECTIONS.map((s) => html`<section class="card">
        <div class="card-head" style="cursor:pointer" onClick=${() => setOpen(open === s.key ? '' : s.key)}>
          <${Icon} name=${s.icon} /><h3>${s.title}</h3>
          <span class="grow"></span><${Icon} name=${open === s.key ? 'expand_less' : 'expand_more'} />
        </div>
        ${open === s.key && html`<div class="card-body stack">
          ${s.fields && html`<${FieldsGrid} fields=${s.fields} value=${v[s.key]} onChange=${(nv) => setV({ ...v, [s.key]: nv })} />`}
          ${s.list && html`<${Repeater} item=${s.item} blank=${s.blank} value=${v[s.key]} onChange=${(nv) => setV({ ...v, [s.key]: nv })} />`}
          ${s.items && html`<${Repeater} label=${s.items.label} item=${s.items.item} blank=${s.items.blank} value=${v[s.key]?.items}
            onChange=${(items) => setV({ ...v, [s.key]: { ...v[s.key], items } })} />`}
        </div>`}
      </section>`)}
    </div>
  </div>`;
}
