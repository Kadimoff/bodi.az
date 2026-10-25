// Admin entry: session gate, shell layout, navigation and routing.
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html, api, on, useRoute, matchRoute, navigate, session, can, toast } from './lib.js';
import { Icon, Button, Field, Input, ToastHost, ConfirmHost, Alert, Loading } from './ui.js';

import { Dashboard } from './pages/dashboard.js';
import { ProductList, ProductEdit } from './pages/products.js';
import { Categories, Colors } from './pages/catalog.js';
import { OrderList, OrderDetail, Coupons } from './pages/orders.js';
import { Stock, Documents, DocumentEdit, Movements, Warehouses, Suppliers } from './pages/inventory.js';
import { PostList, PostEdit, Reviews, Messages, MediaPage } from './pages/content.js';
import { Homepage } from './pages/homepage.js';
import { SeoSettings, StoreSettings, Users, Audit, Profile } from './pages/system.js';

const ROUTES = [
  ['/', Dashboard, 'dashboard', 'İdarə paneli'],
  ['/products', ProductList, 'catalog', 'Məhsullar'],
  ['/products/:id', ProductEdit, 'catalog', 'Məhsul'],
  ['/categories', Categories, 'catalog', 'Kateqoriyalar'],
  ['/colors', Colors, 'catalog', 'Rənglər'],
  ['/orders', OrderList, 'orders', 'Sifarişlər'],
  ['/orders/:id', OrderDetail, 'orders', 'Sifariş'],
  ['/coupons', Coupons, 'coupons', 'Promokodlar'],
  ['/inventory', Stock, 'inventory', 'Stok qalıqları'],
  ['/inventory/documents', Documents, 'inventory', 'Anbar sənədləri'],
  ['/inventory/documents/:id', DocumentEdit, 'inventory', 'Sənəd'],
  ['/inventory/movements', Movements, 'inventory', 'Stok hərəkətləri'],
  ['/inventory/warehouses', Warehouses, 'inventory', 'Anbarlar'],
  ['/inventory/suppliers', Suppliers, 'inventory', 'Təchizatçılar'],
  ['/posts', PostList, 'content', 'Bloq'],
  ['/posts/:id', PostEdit, 'content', 'Yazı'],
  ['/reviews', Reviews, 'reviews', 'Rəylər'],
  ['/messages', Messages, 'messages', 'Müraciətlər'],
  ['/media', MediaPage, 'media', 'Media kitabxanası'],
  ['/homepage', Homepage, 'content', 'Ana səhifə'],
  ['/seo', SeoSettings, 'seo', 'SEO'],
  ['/settings', StoreSettings, 'settings', 'Tənzimləmələr'],
  ['/users', Users, 'users', 'İstifadəçilər'],
  ['/audit', Audit, 'audit', 'Fəaliyyət jurnalı'],
  ['/profile', Profile, null, 'Profil'],
];

const NAV = [
  { items: [['/', 'space_dashboard', 'İdarə paneli', 'dashboard']] },
  { title: 'Kataloq', items: [['/products', 'checkroom', 'Məhsullar', 'catalog'], ['/categories', 'category', 'Kateqoriyalar', 'catalog'], ['/colors', 'palette', 'Rənglər', 'catalog']] },
  { title: 'Satış', items: [['/orders', 'receipt_long', 'Sifarişlər', 'orders', 'orders'], ['/coupons', 'sell', 'Promokodlar', 'coupons']] },
  {
    title: 'Anbar',
    items: [
      ['/inventory', 'inventory_2', 'Stok qalıqları', 'inventory'],
      ['/inventory/documents', 'description', 'Sənədlər', 'inventory'],
      ['/inventory/movements', 'swap_vert', 'Hərəkətlər', 'inventory'],
      ['/inventory/warehouses', 'warehouse', 'Anbarlar', 'inventory'],
      ['/inventory/suppliers', 'local_shipping', 'Təchizatçılar', 'inventory'],
    ],
  },
  {
    title: 'Məzmun',
    items: [
      ['/homepage', 'home', 'Ana səhifə', 'content'],
      ['/posts', 'article', 'Bloq', 'content'],
      ['/reviews', 'reviews', 'Rəylər', 'reviews', 'reviews'],
      ['/messages', 'mail', 'Müraciətlər', 'messages', 'messages'],
      ['/media', 'photo_library', 'Media', 'media'],
    ],
  },
  { title: 'SEO', items: [['/seo', 'travel_explore', 'SEO tənzimləmələri', 'seo']] },
  { title: 'Sistem', items: [['/settings', 'settings', 'Tənzimləmələr', 'settings'], ['/users', 'group', 'İstifadəçilər', 'users'], ['/audit', 'history', 'Fəaliyyət jurnalı', 'audit']] },
];

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/auth/login', form);
      onLogin(r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return html`<div class="login-wrap">
    <form class="card login-card" onSubmit=${submit}>
      <div class="card-body stack" style="padding:28px">
        <div class="brand"><img class="brand-logo" src="/admin/logo.png" alt="Bodi.az" /><div><b>Bodi.az</b><small>İdarəetmə paneli</small></div></div>
        ${error && html`<${Alert} type="danger">${error}</${Alert}>`}
        <${Field} label="İstifadəçi adı"><${Input} value=${form.username} onInput=${(v) => setForm({ ...form, username: v })} autocomplete="username" autofocus required /></${Field}>
        <${Field} label="Şifrə"><${Input} type="password" value=${form.password} onInput=${(v) => setForm({ ...form, password: v })} autocomplete="current-password" required /></${Field}>
        <${Button} type="submit" variant="primary" loading=${busy} style="width:100%;height:42px">Daxil ol</${Button}>
      </div>
    </form>
  </div>`;
}

function Sidebar({ path, badges, onNavigate }) {
  // Longest nav prefix wins, so /inventory/documents/5 highlights "Sənədlər", not "Stok qalıqları".
  const best = NAV.flatMap((g) => g.items.map(([h]) => h))
    .filter((h) => (h === '/' ? path === '/' : path === h || path.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href) => href === best;
  const u = session.user;
  return html`<aside class="sidebar">
    <a class="brand" href="#/" style="text-decoration:none"><img class="brand-logo" src="/admin/logo-disc.png" alt="Bodi.az" /><div><b>Bodi.az</b><small>İdarəetmə paneli</small></div></a>
    ${NAV.map((g) => {
      const items = g.items.filter((it) => can(it[3]));
      if (!items.length) return null;
      return html`<div class="nav-group">
        ${g.title && html`<div class="nav-title">${g.title}</div>`}
        ${items.map(([href, icon, label, , badge]) => html`<a class="nav-link ${isActive(href) ? 'active' : ''}" href=${`#${href}`} onClick=${onNavigate}>
          <${Icon} name=${icon} />${label}${badge && badges[badge] > 0 && html`<span class="count">${badges[badge]}</span>`}
        </a>`)}
      </div>`;
    })}
    <div class="sidebar-foot">
      <a class="nav-link" href="/" target="_blank"><${Icon} name="storefront" />Sayta bax</a>
      <a class="user-chip" href="#/profile" style="text-decoration:none">
        <div class="avatar">${(u.full_name || u.username).slice(0, 1).toUpperCase()}</div>
        <div style="min-width:0"><b>${u.full_name || u.username}</b><small>${u.role_label}</small></div>
      </a>
    </div>
  </aside>`;
}

function Shell() {
  const route = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const [badges, setBadges] = useState({});
  const refreshBadges = () => api.get('/badges').then(setBadges).catch(() => {});
  useEffect(() => {
    refreshBadges();
    const t = setInterval(refreshBadges, 60000);
    const off = on('badges', refreshBadges);
    return () => { clearInterval(t); off(); };
  }, []);

  let page = null;
  let params = {};
  let title = '';
  for (const [pattern, Comp, perm, label] of ROUTES) {
    const m = matchRoute(pattern, route.path);
    if (m) {
      if (perm && !can(perm)) {
        page = () => html`<${Alert} type="warn">Bu bölməyə giriş icazəniz yoxdur.</${Alert}>`;
      } else page = Comp;
      params = m;
      title = label;
      break;
    }
  }
  useEffect(() => { document.title = `${title || 'Səhifə'} — Bodi.az admin`; }, [title]);
  const Page = page;

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    location.reload();
  }

  return html`<div class="shell ${navOpen ? 'nav-open' : ''}">
    <${Sidebar} path=${route.path} badges=${badges} onNavigate=${() => setNavOpen(false)} />
    <div class="main" onClick=${() => navOpen && setNavOpen(false)}>
      <header class="topbar">
        <${Button} variant="ghost" icon="menu" className="menu-btn" onClick=${(e) => { e.stopPropagation(); setNavOpen(!navOpen); }} aria-label="Menyu" />
        <div class="crumbs"><a href="#/">Bodi.az</a><${Icon} name="chevron_right" cls="sm" /><span>${title}</span></div>
        <span class="spacer"></span>
        <${Button} size="sm" variant="ghost" icon="logout" onClick=${logout}>Çıxış</${Button}>
      </header>
      <main class="content">
        ${Page ? html`<${Page} key=${route.path} params=${params} query=${route.query} />` : html`<${Alert} type="warn">Səhifə tapılmadı. <a href="#/">İdarə panelinə qayıt</a></${Alert}>`}
      </main>
    </div>
  </div>`;
}

function App() {
  const [state, setState] = useState('loading');
  useEffect(() => {
    api.get('/auth/me')
      .then((r) => { session.user = r.user; setState('ready'); })
      .catch(() => setState('login'));
    return on('unauthorized', () => {
      if (session.user) toast.error('Sessiya bitib. Yenidən daxil olun.');
      session.user = null;
      setState('login');
    });
  }, []);
  return html`
    ${state === 'loading' && html`<div class="boot"><${Loading} /></div>`}
    ${state === 'login' && html`<${Login} onLogin=${(u) => { session.user = u; setState('ready'); navigate(location.hash.replace(/^#/, '') || '/', { replace: true }); }} />`}
    ${state === 'ready' && html`<${Shell} />`}
    <${ToastHost} />
    <${ConfirmHost} />`;
}

render(html`<${App} />`, document.getElementById('app'));
