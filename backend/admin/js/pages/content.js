import { useState, useEffect } from 'preact/hooks';
import { html, api, fmt, useAsync, setQuery, navigate, attempt, confirmDialog, slugify, stripHtml, useDirtyGuard, emit } from '../lib.js';
import {
  Card, PageHeader, Loading, ErrorBox, Icon, Button, Field, Input, Textarea, Select, Switch, FilterTabs, Tabs,
  SearchInput, Pager, Empty, Badge, statusBadge, Modal, Thumb, Stars, TagInput, Counter,
} from '../ui.js';
import { MediaField, MediaLibrary } from '../media.js';
import { RichText } from '../editor.js';
import { SeoPanel } from '../seo.js';

// ------------------------------------------------------------------- posts
export function PostList({ query }) {
  const page = Number(query.page) || 1;
  const { data, loading, error, reload } = useAsync(() => api.get('/posts', { ...query, page }), [JSON.stringify(query)]);
  return html`<div>
    <${PageHeader} title="Bloq" subtitle="Valideynlər üçün məqalələr — SEO trafikinin əsas mənbəyi">
      <${Button} variant="primary" icon="add" onClick=${() => navigate('/posts/new')}>Yeni yazı</${Button}>
    </${PageHeader}>
    <div class="card">
      <${FilterTabs} value=${query.status || ''} onChange=${(v) => setQuery({ status: v, page: '' })} items=${[{ value: '', label: 'Hamısı' }, { value: 'published', label: 'Dərc olunub' }, { value: 'draft', label: 'Qaralama' }]} />
      <div class="toolbar"><${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} placeholder="Başlıq…" /></div>
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length
        ? html`<${Empty} icon="article" title="Yazı yoxdur" />`
        : html`<div class="table-wrap"><table class="table">
          <thead><tr><th colspan="2">Başlıq</th><th>Kateqoriya</th><th>Oxu</th><th>Status</th><th>Dərc tarixi</th></tr></thead>
          <tbody>${data.items.map((p) => html`<tr class="click" onClick=${() => navigate(`/posts/${p.id}`)}>
            <td style="width:52px"><${Thumb} src=${p.thumb} /></td>
            <td><div class="name">${p.title}</div><div class="sub mono">?b=${p.slug}</div></td>
            <td>${p.category || '—'}</td>
            <td class="small">${p.reading_minutes} dəq</td>
            <td>${statusBadge(p.status)}</td>
            <td class="small">${fmt.date(p.published_at)}</td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
  </div>`;
}

const EMPTY_POST = { title: '', slug: '', excerpt: '', content: '', cover: null, category: '', tags: [], status: 'draft', published_at: '', seo: {} };

export function PostEdit({ params }) {
  const isNew = params.id === 'new';
  const { data, error } = useAsync(() => (isNew ? Promise.resolve(null) : api.get(`/posts/${params.id}`)), [params.id]);
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState('');
  const [tab, setTab] = useState('main');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const src = isNew ? EMPTY_POST : data && { ...EMPTY_POST, ...data, published_at: data.published_at ? fmt.localInput(data.published_at) : '' };
    if (src) { setF(src); setSaved(JSON.stringify(src)); }
  }, [data, isNew]);
  const dirty = f && JSON.stringify(f) !== saved;
  useDirtyGuard(dirty);
  if (error) return html`<${ErrorBox} error=${error} />`;
  if (!f) return html`<${Loading} />`;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function save(status) {
    setBusy(true);
    try {
      const body = { ...f, status: status || f.status, slug: f.slug || slugify(f.title), cover_id: f.cover?.id || null, published_at: f.published_at ? new Date(f.published_at).toISOString() : null };
      const r = await attempt(() => (isNew ? api.post('/posts', body) : api.put(`/posts/${params.id}`, body)), 'Yazı yadda saxlanıldı');
      const next = { ...f, ...r, cover: f.cover, published_at: r.published_at ? fmt.localInput(r.published_at) : '' };
      setF(next);
      setSaved(JSON.stringify(next));
      if (isNew) navigate(`/posts/${r.id}`, { replace: true });
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!(await confirmDialog({ title: 'Yazını silmək', message: `“${f.title}” silinsin?`, confirmText: 'Sil', danger: true }))) return;
    await attempt(() => api.del(`/posts/${params.id}`), 'Silindi');
    navigate('/posts');
  }
  const words = stripHtml(f.content).split(/\s+/).filter(Boolean).length;

  return html`<div>
    <${PageHeader} title=${isNew ? 'Yeni yazı' : f.title}>
      ${!isNew && f.status === 'published' && html`<a class="btn" href=${`/blog-post.html?b=${f.slug}`} target="_blank"><${Icon} name="open_in_new" />Saytda bax</a>`}
      ${dirty && html`<${Badge} color="amber">Yadda saxlanmayıb</${Badge}>`}
      <${Button} variant="primary" icon="save" loading=${busy} onClick=${() => save()}>Yadda saxla</${Button}>
    </${PageHeader}>
    <${Tabs} value=${tab} onChange=${setTab} items=${[{ value: 'main', label: 'Məzmun', icon: 'edit_note' }, { value: 'seo', label: 'SEO', icon: 'travel_explore' }]} />
    <div class="edit-layout">
      <div class="stack">
        ${tab === 'main' ? html`<${Card}><div class="stack">
          <${Field} label="Başlıq" required counter=${html`<${Counter} value=${f.title} min=${20} max=${70} />`}>
            <${Input} value=${f.title} onInput=${(v) => setF((x) => ({ ...x, title: v, slug: isNew && (!x.slug || x.slug === slugify(x.title)) ? slugify(v) : x.slug }))} />
          </${Field}>
          <${Field} label="URL (slug)"><div class="input-group"><span class="addon">blog-post.html?b=</span><${Input} value=${f.slug} onInput=${(v) => set('slug', slugify(v))} /></div></${Field}>
          <${Field} label="Qısa xülasə" help="Bloq siyahısında və meta təsvirdə istifadə olunur."><${Textarea} rows="3" value=${f.excerpt} onInput=${(v) => set('excerpt', v)} /></${Field}>
          <${Field} label="Məzmun" help=${`${words} söz · təxminən ${Math.max(1, Math.round(words / 200))} dəqiqəlik oxu`}><${RichText} value=${f.content} onChange=${(v) => set('content', v)} /></${Field}>
        </div></${Card}>`
        : html`<${SeoPanel} value=${f.seo} onChange=${(v) => set('seo', v)} kind="post" slug=${f.slug} path="blog-post.html?b="
            auto=${{ title: `${f.title} | Bodi.az`, description: (f.excerpt || stripHtml(f.content)).slice(0, 158) }}
            content=${f.content} images=${f.cover ? [f.cover] : []} />`}
      </div>
      <div class="side">
        <${Card} title="Dərc" icon="public"><div class="stack">
          <${Field} label="Status"><${Select} value=${f.status} onChange=${(v) => set('status', v)} options=${[{ value: 'draft', label: 'Qaralama' }, { value: 'published', label: 'Dərc olunub' }]} /></${Field}>
          <${Field} label="Dərc tarixi" help="Gələcək tarix seçsəniz, yazı həmin vaxt avtomatik görünəcək."><input class="input" type="datetime-local" value=${f.published_at} onInput=${(e) => set('published_at', e.currentTarget.value)} /></${Field}>
          ${f.status !== 'published' && html`<${Button} variant="primary" icon="publish" loading=${busy} onClick=${() => save('published')}>Dərc et</${Button}>`}
        </div></${Card}>
        <${Card} title="Örtük şəkli" icon="image"><${MediaField} value=${f.cover} onChange=${(v) => set('cover', v)} /></${Card}>
        <${Card} title="Təşkil" icon="folder"><div class="stack">
          <${Field} label="Kateqoriya"><${Input} value=${f.category} onInput=${(v) => set('category', v)} placeholder="Qulluq, Geyim, Yuxu…" list="post-cats" /></${Field}>
          <datalist id="post-cats"><option value="Yeni doğulanlar" /><option value="Geyim" /><option value="Qulluq" /><option value="Qidalanma" /><option value="Yuxu" /></datalist>
          <${Field} label="Teqlər"><${TagInput} value=${f.tags} onChange=${(v) => set('tags', v)} /></${Field}>
        </div></${Card}>
        ${!isNew && html`<${Button} variant="danger" icon="delete" onClick=${remove}>Yazını sil</${Button}>`}
      </div>
    </div>
  </div>`;
}

// ----------------------------------------------------------------- reviews
function ReviewPhotos({ images, onRemove }) {
  if (!images || !images.length) return null;
  return html`<div class="review-photos">${images.map((img) => html`<div class="review-photo">
    <a href=${img.full} target="_blank" rel="noopener" title="Böyük ölçüdə aç"><img src=${img.thumb} alt="Müştəri şəkli" loading="lazy" /></a>
    ${onRemove && html`<button type="button" class="review-photo-del" title="Şəkli sil" onClick=${() => onRemove(img)}><span class="material-symbols-outlined">delete</span></button>`}
  </div>`)}</div>`;
}

function ReviewModal({ item, onClose, onSaved }) {
  const [f, setF] = useState({ ...item });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function removePhoto(img) {
    if (!(await confirmDialog({ title: 'Şəkli silmək', message: 'Bu müştəri şəkli birdəfəlik silinsin? Rəy qalacaq.', confirmText: 'Sil', danger: true }))) return;
    await attempt(() => api.del(`/reviews/${item.id}/images/${img.id}`), 'Şəkil silindi');
    set('images', (f.images || []).filter((x) => x.id !== img.id));
    onSaved({ keepOpen: true });
  }
  async function save() {
    await attempt(() => api.put(`/reviews/${item.id}`, f), 'Rəy yeniləndi');
    onSaved();
  }
  return html`<${Modal} title=${`Rəy — ${item.product_name}`} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" onClick=${save}>Yadda saxla</${Button}>`}>
    <div class="stack">
      <div class="form-grid">
        <${Field} label="Müəllif"><${Input} value=${f.author} onInput=${(v) => set('author', v)} /></${Field}>
        <${Field} label="Şəhər"><${Input} value=${f.city} onInput=${(v) => set('city', v)} /></${Field}>
        <${Field} label="Reytinq"><${Select} value=${f.rating} onChange=${(v) => set('rating', Number(v))} options=${[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${'★'.repeat(n)} (${n})` }))} /></${Field}>
        <${Field} label="Status"><${Select} value=${f.status} onChange=${(v) => set('status', v)} options=${[{ value: 'approved', label: 'Təsdiqlənib (saytda görünür)' }, { value: 'pending', label: 'Gözləyir' }, { value: 'rejected', label: 'Rədd edilib' }]} /></${Field}>
      </div>
      <${Field} label="Rəy"><${Textarea} rows="4" value=${f.content} onInput=${(v) => set('content', v)} /></${Field}>
      ${(f.images || []).length > 0 && html`<${Field} label=${`Müştəri şəkilləri (${f.images.length})`} help="Təsdiqlənən rəylə birlikdə saytda görünür. Uyğun olmayan şəkli silə bilərsiniz."><${ReviewPhotos} images=${f.images} onRemove=${removePhoto} /></${Field}>`}
      <${Field} label="Mağazanın cavabı" help="Gələcəkdə məhsul səhifəsində göstərilə bilər."><${Textarea} rows="3" value=${f.reply} onInput=${(v) => set('reply', v)} /></${Field}>
      <${Switch} checked=${f.is_verified} onChange=${(v) => set('is_verified', v)} label="Təsdiqlənmiş alıcı" />
    </div>
  </${Modal}>`;
}

export function Reviews({ query }) {
  const page = Number(query.page) || 1;
  const { data, loading, error, reload } = useAsync(() => api.get('/reviews', { ...query, page }), [JSON.stringify(query)]);
  const [sel, setSel] = useState([]);
  const [edit, setEdit] = useState(null);
  const counts = data?.counts || {};
  async function bulk(action, ids = sel) {
    if (action === 'delete' && !(await confirmDialog({ title: 'Rəyləri silmək', message: `${ids.length} rəy birdəfəlik silinsin?`, confirmText: 'Sil', danger: true }))) return;
    await attempt(() => api.post('/reviews/bulk', { ids, action }), 'Yeniləndi');
    setSel([]);
    reload();
    emit('badges');
  }
  return html`<div>
    <${PageHeader} title="Rəylər" subtitle="Müştəri rəylərinin moderasiyası. Təsdiqlənmiş rəylər məhsul reytinqinə və Google ulduzlarına təsir edir." />
    <div class="card">
      <${FilterTabs} value=${query.status || ''} onChange=${(v) => setQuery({ status: v, page: '' })} items=${[
        { value: '', label: 'Hamısı' }, { value: 'pending', label: 'Gözləyir', count: counts.pending || 0 },
        { value: 'approved', label: 'Təsdiqlənib', count: counts.approved || 0 }, { value: 'rejected', label: 'Rədd edilib', count: counts.rejected || 0 },
      ]} />
      <div class="toolbar">
        <${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} placeholder="Müəllif, mətn, məhsul…" />
        <${Select} value=${query.rating} onChange=${(v) => setQuery({ rating: v, page: '' })} placeholder="Bütün reytinqlər" options=${[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} ulduz` }))} />
      </div>
      ${sel.length > 0 && html`<div class="bulkbar"><span>${sel.length} seçilib</span>
        <${Button} size="sm" icon="check" onClick=${() => bulk('approved')}>Təsdiqlə</${Button}>
        <${Button} size="sm" icon="block" onClick=${() => bulk('rejected')}>Rədd et</${Button}>
        <${Button} size="sm" variant="danger" icon="delete" onClick=${() => bulk('delete')}>Sil</${Button}>
      </div>`}
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length
        ? html`<${Empty} icon="reviews" title="Rəy yoxdur" />`
        : html`<div class="table-wrap"><table class="table">
          <thead><tr><th style="width:36px"></th><th>Rəy</th><th>Məhsul</th><th>Reytinq</th><th>Status</th><th>Tarix</th><th></th></tr></thead>
          <tbody>${data.items.map((r) => html`<tr>
            <td><input type="checkbox" checked=${sel.includes(r.id)} onChange=${() => setSel(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])} /></td>
            <td style="max-width:420px"><div class="name">${r.author} <span class="sub">· ${r.city}</span>${r.is_verified && html` <${Badge} color="green">alıcı</${Badge}>`}</div><div class="small">${r.content}</div>${(r.images || []).length > 0 && html`<div class="review-photos review-photos-sm">${r.images.slice(0, 4).map((img) => html`<img src=${img.thumb} alt="" loading="lazy" />`)}<span class="sub">${r.images.length} şəkil</span></div>`}
              ${r.reply && html`<div class="small muted" style="margin-top:4px">↳ ${r.reply}</div>`}</td>
            <td class="small"><a href=${`#/products/${r.product_id}`}>${r.product_name}</a></td>
            <td><${Stars} n=${r.rating} /></td>
            <td>${statusBadge(r.status)}</td>
            <td class="small nowrap">${fmt.datetime(r.created_at)}</td>
            <td><div class="cell-actions">
              ${r.status !== 'approved' && html`<${Button} size="sm" icon="check" title="Təsdiqlə" onClick=${() => bulk('approved', [r.id])} />`}
              ${r.status !== 'rejected' && html`<${Button} size="sm" icon="block" title="Rədd et" onClick=${() => bulk('rejected', [r.id])} />`}
              <${Button} size="sm" icon="edit" title="Redaktə" onClick=${() => setEdit(r)} />
            </div></td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
    ${edit && html`<${ReviewModal} item=${edit} onClose=${() => setEdit(null)} onSaved=${(o) => { if (!o || !o.keepOpen) setEdit(null); reload(); emit('badges'); }} />`}
  </div>`;
}

// ---------------------------------------------------------------- messages
export function Messages({ query }) {
  const page = Number(query.page) || 1;
  const { data, loading, error, reload } = useAsync(() => api.get('/messages', { ...query, page }), [JSON.stringify(query)]);
  const [open, setOpen] = useState(null);
  async function setStatus(m, status) {
    await attempt(() => api.put(`/messages/${m.id}`, { status }));
    reload();
    emit('badges');
  }
  async function remove(m) {
    if (!(await confirmDialog({ title: 'Mesajı silmək', message: `${m.name} adlı müraciət silinsin?`, confirmText: 'Sil', danger: true }))) return;
    await attempt(() => api.del(`/messages/${m.id}`), 'Silindi');
    setOpen(null);
    reload();
    emit('badges');
  }
  function show(m) {
    setOpen(m);
    if (m.status === 'new') setStatus(m, 'read');
  }
  const wa = (p) => `https://wa.me/${String(p).replace(/\D/g, '')}`;
  return html`<div>
    <${PageHeader} title="Müraciətlər" subtitle="Əlaqə formundan gələn mesajlar" />
    <div class="card">
      <${FilterTabs} value=${query.status || ''} onChange=${(v) => setQuery({ status: v, page: '' })} items=${[{ value: '', label: 'Hamısı' }, { value: 'new', label: 'Yeni' }, { value: 'read', label: 'Oxunub' }, { value: 'archived', label: 'Arxiv' }]} />
      <div class="toolbar"><${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} /></div>
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length
        ? html`<${Empty} icon="mail" title="Müraciət yoxdur" />`
        : html`<div class="table-wrap"><table class="table">
          <thead><tr><th>Ad</th><th>Əlaqə</th><th>Mesaj</th><th>Status</th><th>Tarix</th></tr></thead>
          <tbody>${data.items.map((m) => html`<tr class="click" onClick=${() => show(m)} style=${m.status === 'new' ? 'font-weight:600' : ''}>
            <td class="name">${m.name}</td>
            <td class="small">${m.phone}${m.email && html`<div>${m.email}</div>`}</td>
            <td class="small" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.message}</td>
            <td>${m.status === 'new' ? html`<${Badge} color="blue">Yeni</${Badge}>` : statusBadge(m.status)}</td>
            <td class="small nowrap">${fmt.datetime(m.created_at)}</td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
    ${open && html`<${Modal} title=${open.name} onClose=${() => setOpen(null)}
      footer=${html`<${Button} variant="danger" icon="delete" onClick=${() => remove(open)}>Sil</${Button}><span class="grow"></span>
        ${open.status !== 'archived' && html`<${Button} icon="archive" onClick=${() => { setStatus(open, 'archived'); setOpen(null); }}>Arxivlə</${Button}>`}
        ${open.phone && html`<a class="btn primary" href=${wa(open.phone)} target="_blank"><${Icon} name="chat" />WhatsApp</a>`}`}>
      <dl class="kv"><dt>Telefon</dt><dd>${open.phone ? html`<a href=${`tel:${open.phone}`}>${open.phone}</a>` : '—'}</dd>
        <dt>E-poçt</dt><dd>${open.email ? html`<a href=${`mailto:${open.email}`}>${open.email}</a>` : '—'}</dd>
        <dt>Tarix</dt><dd>${fmt.datetime(open.created_at)}</dd></dl>
      <div class="hr"></div>
      <p style="white-space:pre-wrap;margin:0">${open.message}</p>
    </${Modal}>`}
  </div>`;
}

// ------------------------------------------------------------------- media
export function MediaPage() {
  return html`<div>
    <${PageHeader} title="Media kitabxanası" subtitle="Bütün şəkil və videolar. Faylı açıb alt mətni (SEO) redaktə edin." />
    <${Card}><${MediaLibrary} /></${Card}>
  </div>`;
}
