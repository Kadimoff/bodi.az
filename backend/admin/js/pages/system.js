import { useState, useEffect } from 'preact/hooks';
import { html, api, fmt, useAsync, setQuery, attempt, confirmDialog, useDirtyGuard, session, navigate } from '../lib.js';
import {
  Card, PageHeader, Loading, ErrorBox, Icon, Button, Field, Input, NumberInput, Textarea, Select, Switch,
  SearchInput, Pager, Empty, Alert, Badge, Modal, Counter, TagInput, ScoreBadge,
} from '../ui.js';
import { MediaUrlField } from '../media.js';
import { SerpPreview } from '../seo.js';

function useSetting(key) {
  const { data, loading, error, reload } = useAsync(() => api.get(`/settings/${key}`), [key]);
  const [v, setV] = useState(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) { setV(data.value); setSaved(JSON.stringify(data.value)); } }, [data]);
  const dirty = v && JSON.stringify(v) !== saved;
  useDirtyGuard(dirty);
  async function save() {
    setBusy(true);
    try {
      const r = await attempt(() => api.put(`/settings/${key}`, { value: v }), 'Tənzimləmələr yadda saxlanıldı');
      setV(r.value);
      setSaved(JSON.stringify(r.value));
    } finally { setBusy(false); }
  }
  return { v, set: (k, val) => setV((x) => ({ ...x, [k]: val })), loading: loading || !v, error, reload, save, busy, dirty };
}

// --------------------------------------------------------------------- SEO
export function SeoSettings() {
  const s = useSetting('seo');
  const audit = useAsync(() => api.get('/products', { per_page: 200, status: 'published' }), []);
  if (s.error) return html`<${ErrorBox} error=${s.error} onRetry=${s.reload} />`;
  if (s.loading) return html`<${Loading} />`;
  const v = s.v;
  const f = (k, label, opts = {}) => html`<${Field} label=${label} help=${opts.help} className=${opts.full ? 'full' : ''}
      counter=${opts.counter && html`<${Counter} value=${v[k]} min=${opts.counter[0]} max=${opts.counter[1]} />`}>
    ${opts.textarea ? html`<${Textarea} rows="2" value=${v[k]} onInput=${(x) => s.set(k, x)} />`
      : opts.image ? html`<${MediaUrlField} value=${v[k]} onChange=${(x) => s.set(k, x)} />`
        : html`<${Input} className=${opts.mono ? 'mono' : ''} value=${v[k]} onInput=${(x) => s.set(k, x)} placeholder=${opts.placeholder} />`}
  </${Field}>`;
  const weak = (audit.data?.items || []).filter((p) => p.seo_score < 80).sort((a, b) => a.seo_score - b.seo_score);

  return html`<div>
    <${PageHeader} title="SEO tənzimləmələri" subtitle="Bütün sayt üçün meta məlumatlar, sosial paylaşım, Schema.org və axtarış motorlarının təsdiqi">
      <a class="btn" href="/sitemap.xml" target="_blank"><${Icon} name="account_tree" />sitemap.xml</a>
      <a class="btn" href="/robots.txt" target="_blank"><${Icon} name="smart_toy" />robots.txt</a>
      ${s.dirty && html`<${Badge} color="amber">Yadda saxlanmayıb</${Badge}>`}
      <${Button} variant="primary" icon="save" loading=${s.busy} onClick=${s.save}>Yadda saxla</${Button}>
    </${PageHeader}>
    <div class="edit-layout">
      <div class="stack">
        <${Card} title="Ana səhifə və ümumi meta" icon="home">
          <div class="form-grid">
            ${f('meta_title', 'Sayt başlığı (title)', { full: true, counter: [30, 60] })}
            ${f('meta_description', 'Meta təsvir', { full: true, textarea: true, counter: [110, 160] })}
            ${f('keywords', 'Açar sözlər', { full: true })}
            ${f('canonical_url', 'Saytın əsas ünvanı', { mono: true, placeholder: 'https://bodi.az/' })}
            ${f('robots', 'Robots direktivi', { mono: true })}
          </div>
        </${Card}>
        <${Card} title="Başlıq şablonları" icon="title">
          <div class="stack">
            <div class="small muted"><span class="kbd">%s</span> səhifənin adı ilə əvəz olunur. Fərdi SEO başlığı yazılmayan səhifələrdə istifadə olunur.</div>
            <div class="form-grid">
              ${f('product_title_template', 'Məhsul səhifələri', { mono: true })}
              ${f('category_title_template', 'Kateqoriya səhifələri', { mono: true })}
              ${f('title_template', 'Digər səhifələr və bloq', { mono: true })}
            </div>
          </div>
        </${Card}>
        <${Card} title="Sosial şəbəkələr (OpenGraph / Twitter)" icon="share">
          <div class="form-grid">
            ${f('og_title', 'OG başlıq', { placeholder: v.meta_title })}
            ${f('og_site_name', 'Sayt adı')}
            ${f('og_description', 'OG təsvir', { full: true, textarea: true })}
            ${f('og_image', 'Standart paylaşım şəkli (1200×630 tövsiyə olunur)', { full: true, image: true })}
            ${f('twitter_title', 'Twitter başlıq', { placeholder: v.meta_title })}
            <${Field} label="Twitter kart növü"><${Select} value=${v.twitter_card} onChange=${(x) => s.set('twitter_card', x)} options=${[{ value: 'summary_large_image', label: 'Böyük şəkilli' }, { value: 'summary', label: 'Kiçik' }]} /></${Field}>
          </div>
        </${Card}>
        <${Card} title="Schema.org — mağaza məlumatları" icon="schema">
          <div class="stack">
            <div class="small muted">Google-un “bilik paneli” və yerli axtarış üçün strukturlaşdırılmış məlumat (JSON-LD). Məhsul, kateqoriya və bloq səhifələri üçün schema avtomatik yaradılır.</div>
            <div class="form-grid">
              ${f('schema_store_name', 'Mağaza adı')}
              <${Field} label="Biznes növü"><${Select} value=${v.schema_store_type} onChange=${(x) => s.set('schema_store_type', x)} options=${[
                { value: 'ClothingStore', label: 'Geyim mağazası (ClothingStore)' }, { value: 'Store', label: 'Mağaza (Store)' }, { value: 'OnlineStore', label: 'Onlayn mağaza (OnlineStore)' }, { value: 'LocalBusiness', label: 'Yerli biznes' },
              ]} /></${Field}>
              ${f('schema_phone', 'Telefon', { placeholder: '+994-50-123-45-67' })}
              ${f('schema_city', 'Şəhər')}
              ${f('schema_country', 'Ölkə kodu', { mono: true })}
              ${f('schema_price_range', 'Qiymət aralığı', { placeholder: '₼₼' })}
              ${f('schema_opening_hours', 'İş saatları', { mono: true, help: 'Format: Mo-Su 09:00-21:00' })}
              ${f('schema_social_instagram', 'Instagram', { mono: true })}
              ${f('schema_social_facebook', 'Facebook', { mono: true })}
              ${f('schema_logo', 'Loqo', { full: true, image: true })}
            </div>
          </div>
        </${Card}>
        <${Card} title="Axtarış motorlarının təsdiqi" icon="verified">
          <div class="form-grid">
            ${f('google_site_verification', 'Google Search Console', { mono: true, help: 'meta google-site-verification kodu' })}
            ${f('yandex_verification', 'Yandex Webmaster', { mono: true })}
            ${f('bing_verification', 'Bing Webmaster', { mono: true })}
          </div>
        </${Card}>
      </div>
      <div class="side">
        <${Card} title="Ana səhifənin Google görünüşü" icon="travel_explore"><${SerpPreview} title=${v.meta_title} description=${v.meta_description} url=${v.canonical_url || 'https://bodi.az/'} /></${Card}>
        <${Card} title="SEO auditi" icon="checklist" bodyClass="">
          ${audit.loading ? html`<${Loading} />` : !weak.length ? html`<div class="card-body"><${Alert} type="success">Bütün dərc olunmuş məhsulların SEO balı 80+ dır.</${Alert}></div>` : html`
            <div class="card-body small muted" style="padding-bottom:0">${weak.length} məhsulun SEO-su gücləndirilə bilər:</div>
            <div class="table-wrap" style="max-height:420px;overflow:auto"><table class="table"><tbody>
              ${weak.map((p) => html`<tr class="click" onClick=${() => navigate(`/products/${p.id}?tab=seo`)}><td class="name small">${p.name}</td><td class="right"><${ScoreBadge} score=${p.seo_score} /></td></tr>`)}
            </tbody></table></div>`}
          <div class="card-body" style="border-top:1px solid var(--border)"><a href="#/media" class="small"><${Icon} name="image" cls="sm" /> Alt mətni olmayan şəkillər → Media</a></div>
        </${Card}>
        <${Card} title="Avtomatik SEO" icon="auto_awesome">
          <ul class="small" style="margin:0;padding-left:18px;line-height:1.8">
            <li>Server tərəfdə meta teqlər (Google, WhatsApp, Facebook önizləmələri)</li>
            <li>Dinamik <b>sitemap.xml</b> (şəkillərlə)</li>
            <li>Product, BreadcrumbList, CollectionPage, BlogPosting schema</li>
            <li>Slug dəyişəndə köhnə URL-lərdən 301 yönləndirmə</li>
            <li>WebP + responsive şəkillər, alt mətn nəzarəti</li>
            <li>Tapılmayan səhifələr üçün düzgün 404 status</li>
          </ul>
        </${Card}>
      </div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------- store
export function StoreSettings() {
  const s = useSetting('store');
  if (s.error) return html`<${ErrorBox} error=${s.error} onRetry=${s.reload} />`;
  if (s.loading) return html`<${Loading} />`;
  const v = s.v;
  return html`<div>
    <${PageHeader} title="Mağaza tənzimləmələri">
      ${s.dirty && html`<${Badge} color="amber">Yadda saxlanmayıb</${Badge}>`}
      <${Button} variant="primary" icon="save" loading=${s.busy} onClick=${s.save}>Yadda saxla</${Button}>
    </${PageHeader}>
    <div class="grid grid-2">
      <${Card} title="Əlaqə" icon="contact_phone"><div class="stack">
        <${Field} label="Mağaza adı"><${Input} value=${v.store_name} onInput=${(x) => s.set('store_name', x)} /></${Field}>
        <${Field} label="WhatsApp nömrəsi" help="Yalnız rəqəmlər, ölkə kodu ilə: 994501234567. Saytdakı bütün WhatsApp düymələri bu nömrəyə yönəlir.">
          <${Input} className="mono" value=${v.whatsapp} onInput=${(x) => s.set('whatsapp', x.replace(/\D/g, ''))} />
        </${Field}>
        <${Field} label="Telefon"><${Input} value=${v.phone} onInput=${(x) => s.set('phone', x)} /></${Field}>
        <${Field} label="E-poçt"><${Input} value=${v.email} onInput=${(x) => s.set('email', x)} /></${Field}>
      </div></${Card}>
      <${Card} title="Çatdırılma və qaytarma" icon="local_shipping"><div class="stack">
        <div class="form-grid">
          <${Field} label="Çatdırılma haqqı"><div class="input-group"><${NumberInput} value=${v.shipping_fee} onInput=${(x) => s.set('shipping_fee', x)} /><span class="addon">₼</span></div></${Field}>
          <${Field} label="Pulsuz çatdırılma həddi"><div class="input-group"><${NumberInput} value=${v.free_shipping_threshold} onInput=${(x) => s.set('free_shipping_threshold', x)} /><span class="addon">₼</span></div></${Field}>
          <${Field} label="Qaytarma müddəti"><div class="input-group"><${NumberInput} step="1" value=${v.return_days} onInput=${(x) => s.set('return_days', x)} /><span class="addon">gün</span></div></${Field}>
        </div>
        <div class="small muted">Ödəniş səhifəsində məbləğ serverdə bu qaydalarla hesablanır.</div>
      </div></${Card}>
      <${Card} title="Kataloq" icon="checkroom"><div class="stack">
        <${Field} label="Standart ölçülər" help="Yeni məhsulda ölçü təklifləri və ölçüsü göstərilməyən məhsullar üçün."><${TagInput} value=${v.sizes} onChange=${(x) => s.set('sizes', x)} /></${Field}>
        <${Field} label="“Az qalıb” həddi" help="Saytda “son ədədlər” xəbərdarlığı bu saydan az qalanda göstərilir."><${NumberInput} step="1" value=${v.low_stock_threshold} onInput=${(x) => s.set('low_stock_threshold', x)} /></${Field}>
      </div></${Card}>
      <${Card} title="Rəylər" icon="reviews"><div class="stack">
        <${Switch} checked=${v.review_auto_approve} onChange=${(x) => s.set('review_auto_approve', x)} label="Rəyləri avtomatik dərc et"
          sub="Söndürülsə, yeni rəylər “Gözləyir” statusunda qalır və yalnız təsdiqdən sonra saytda görünür." />
      </div></${Card}>
    </div>
  </div>`;
}

// ------------------------------------------------------------------- users
function UserModal({ item, roles, onClose, onSaved }) {
  const isNew = !item?.id;
  const [f, setF] = useState(() => ({ username: '', full_name: '', email: '', role: 'editor', is_active: true, password: '', ...item }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const isRoot = item?.role === 'root';
  const assignable = roles.filter((r) => r.key !== 'root' && (session.user.role === 'root' || !['admin'].includes(r.key)));
  async function save() {
    setBusy(true);
    try {
      const body = { ...f };
      if (!body.password) delete body.password;
      await attempt(() => (isNew ? api.post('/users', body) : api.put(`/users/${item.id}`, body)), 'İstifadəçi yadda saxlanıldı');
      onSaved();
    } finally { setBusy(false); }
  }
  const role = roles.find((r) => r.key === f.role);
  return html`<${Modal} title=${isNew ? 'Yeni istifadəçi' : f.username} onClose=${onClose}
    footer=${html`<${Button} onClick=${onClose}>İmtina</${Button}><${Button} variant="primary" loading=${busy} onClick=${save}>Yadda saxla</${Button}>`}>
    <div class="stack">
      <div class="form-grid">
        <${Field} label="İstifadəçi adı" required><${Input} className="mono" value=${f.username} disabled=${!isNew} onInput=${(v) => set('username', v.toLowerCase())} /></${Field}>
        <${Field} label="Ad Soyad"><${Input} value=${f.full_name} onInput=${(v) => set('full_name', v)} /></${Field}>
        <${Field} label="E-poçt"><${Input} type="email" value=${f.email} onInput=${(v) => set('email', v)} /></${Field}>
        <${Field} label="Rol">${isRoot ? html`<${Input} value="Root" disabled />` : html`<${Select} value=${f.role} onChange=${(v) => set('role', v)} options=${assignable.map((r) => ({ value: r.key, label: r.label }))} />`}</${Field}>
      </div>
      ${role && !isRoot && html`<div class="small muted">İcazələr: ${role.perms.join(', ')}</div>`}
      <${Field} label=${isNew ? 'Şifrə' : 'Yeni şifrə (dəyişmək üçün)'} required=${isNew} help="Ən azı 10 simvol, hərf və rəqəm.">
        <${Input} type="password" value=${f.password} onInput=${(v) => set('password', v)} autocomplete="new-password" />
      </${Field}>
      ${!isRoot && html`<${Switch} checked=${f.is_active} onChange=${(v) => set('is_active', v)} label="Aktiv" sub="Deaktiv istifadəçi sistemə daxil ola bilməz." />`}
    </div>
  </${Modal}>`;
}

export function Users() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([api.get('/users'), api.get('/users/roles')]), []);
  const [edit, setEdit] = useState(null);
  async function remove(u) {
    if (!(await confirmDialog({ title: 'İstifadəçini silmək', message: `${u.username} silinsin?`, confirmText: 'Sil', danger: true, typeToConfirm: u.username }))) return;
    await attempt(() => api.del(`/users/${u.id}`), 'Silindi');
    reload();
  }
  if (error) return html`<${ErrorBox} error=${error} onRetry=${reload} />`;
  if (loading) return html`<${Loading} />`;
  const [users, roles] = data;
  const roleColor = { root: 'dark', admin: 'purple', editor: 'blue', warehouse: 'amber' };
  return html`<div>
    <${PageHeader} title="İstifadəçilər" subtitle="Admin panelə giriş və rollar">
      <${Button} variant="primary" icon="person_add" onClick=${() => setEdit({})}>Yeni istifadəçi</${Button}>
    </${PageHeader}>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>İstifadəçi</th><th>Rol</th><th>Status</th><th>Son giriş</th><th></th></tr></thead>
      <tbody>${users.map((u) => html`<tr class="click" onClick=${() => setEdit(u)}>
        <td><div class="row"><div class="avatar" style="background:var(--primary)">${(u.full_name || u.username)[0].toUpperCase()}</div>
          <div><div class="name">${u.full_name || u.username}</div><div class="sub mono">${u.username}${u.email ? ` · ${u.email}` : ''}</div></div></div></td>
        <td><${Badge} color=${roleColor[u.role]}>${u.role_label}</${Badge}></td>
        <td>${u.is_active ? html`<${Badge} color="green">Aktiv</${Badge}>` : html`<${Badge} color="red">Deaktiv</${Badge}>`}</td>
        <td class="small">${u.last_login_at ? fmt.ago(u.last_login_at) : 'heç vaxt'}</td>
        <td onClick=${(e) => e.stopPropagation()}>${u.role !== 'root' && u.id !== session.user.id && html`<${Button} size="sm" variant="ghost" icon="delete" onClick=${() => remove(u)} />`}</td>
      </tr>`)}</tbody>
    </table></div></div>
    <${Card} title="Rollar" icon="admin_panel_settings" className="mt">
      <dl class="kv small">${roles.map((r) => html`<dt><b>${r.label}</b></dt><dd>${r.perms.includes('*') ? 'Hər şey, istifadəçilərin idarəsi daxil' : r.perms.join(', ')}</dd>`)}</dl>
    </${Card}>
    ${edit && html`<${UserModal} item=${edit.id ? edit : null} roles=${roles} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); reload(); }} />`}
  </div>`;
}

// ------------------------------------------------------------------- audit
const ACTIONS = { create: 'Yaratdı', update: 'Dəyişdi', delete: 'Sildi', login: 'Daxil oldu', upload: 'Yüklədi', post: 'Təsdiqlədi', cancel: 'Ləğv etdi', reverse: 'Əks sənəd', status: 'Status', password: 'Şifrə', reset: 'Sıfırladı' };
const ENTITIES = { product: 'Məhsul', category: 'Kateqoriya', color: 'Rəng', media: 'Media', order: 'Sifariş', coupon: 'Promokod', post: 'Yazı', review: 'Rəy', message: 'Mesaj', settings: 'Tənzimləmə', user: 'İstifadəçi', warehouse: 'Anbar', supplier: 'Təchizatçı', stock_document: 'Anbar sənədi', variant: 'Variant' };

export function Audit({ query }) {
  const page = Number(query.page) || 1;
  const { data, loading, error, reload } = useAsync(() => api.get('/audit', { ...query, page }), [JSON.stringify(query)]);
  return html`<div>
    <${PageHeader} title="Fəaliyyət jurnalı" subtitle="Admin paneldə kim, nə vaxt, nə etdi" />
    <div class="card">
      <div class="toolbar">
        <${SearchInput} value=${query.q} onInput=${(v) => setQuery({ q: v, page: '' })} />
        <${Select} value=${query.entity} onChange=${(v) => setQuery({ entity: v, page: '' })} placeholder="Bütün bölmələr" options=${Object.entries(ENTITIES).map(([value, label]) => ({ value, label }))} />
      </div>
      ${error ? html`<div class="card-body"><${ErrorBox} error=${error} onRetry=${reload} /></div>` : loading && !data ? html`<${Loading} />` : !data.items.length ? html`<${Empty} icon="history" title="Qeyd yoxdur" />` : html`
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Tarix</th><th>İstifadəçi</th><th>Əməliyyat</th><th>Bölmə</th><th>Təfərrüat</th><th>IP</th></tr></thead>
          <tbody>${data.items.map((a) => html`<tr>
            <td class="small nowrap">${fmt.datetime(a.created_at)}</td>
            <td class="mono small">${a.username || '—'}</td>
            <td><${Badge}>${ACTIONS[a.action.split(':')[0]] || a.action}${a.action.includes(':') ? ` (${a.action.split(':')[1]})` : ''}</${Badge}></td>
            <td class="small">${ENTITIES[a.entity] || a.entity} ${a.entity_id && html`<span class="mono faint">#${a.entity_id.slice(0, 40)}</span>`}</td>
            <td class="small">${a.summary}</td>
            <td class="mono small faint">${a.ip}</td>
          </tr>`)}</tbody>
        </table></div>
        <${Pager} page=${page} perPage=${data.per_page} total=${data.total} />`}
    </div>
  </div>`;
}

// ----------------------------------------------------------------- profile
export function Profile() {
  const u = session.user;
  const [p, setP] = useState({ full_name: u.full_name, email: u.email });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  async function saveProfile() {
    const r = await attempt(() => api.put('/auth/me', p), 'Profil yeniləndi');
    Object.assign(session.user, r.user);
  }
  async function changePassword() {
    if (pw.new_password !== pw.confirm) return attempt(() => Promise.reject(new Error('Yeni şifrələr uyğun gəlmir.')));
    setBusy(true);
    try {
      await attempt(() => api.put('/auth/me/password', pw), 'Şifrə dəyişdirildi. Digər cihazlardakı sessiyalar bağlandı.');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } finally { setBusy(false); }
  }
  return html`<div>
    <${PageHeader} title="Profil" subtitle=${html`<span class="mono">${u.username}</span> · ${u.role_label}`} />
    <div class="grid grid-2">
      <${Card} title="Şəxsi məlumatlar" icon="person"><div class="stack">
        <${Field} label="Ad Soyad"><${Input} value=${p.full_name} onInput=${(v) => setP({ ...p, full_name: v })} /></${Field}>
        <${Field} label="E-poçt"><${Input} type="email" value=${p.email} onInput=${(v) => setP({ ...p, email: v })} /></${Field}>
        <div><${Button} variant="primary" onClick=${saveProfile}>Yadda saxla</${Button}></div>
      </div></${Card}>
      <${Card} title="Şifrəni dəyiş" icon="lock"><div class="stack">
        <${Field} label="Cari şifrə"><${Input} type="password" value=${pw.current_password} onInput=${(v) => setPw({ ...pw, current_password: v })} autocomplete="current-password" /></${Field}>
        <${Field} label="Yeni şifrə" help="Ən azı 10 simvol, hərf və rəqəm."><${Input} type="password" value=${pw.new_password} onInput=${(v) => setPw({ ...pw, new_password: v })} autocomplete="new-password" /></${Field}>
        <${Field} label="Yeni şifrə (təkrar)"><${Input} type="password" value=${pw.confirm} onInput=${(v) => setPw({ ...pw, confirm: v })} autocomplete="new-password" /></${Field}>
        <div><${Button} variant="primary" loading=${busy} onClick=${changePassword}>Şifrəni dəyiş</${Button}></div>
      </div></${Card}>
    </div>
  </div>`;
}
