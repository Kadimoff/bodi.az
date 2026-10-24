import { html, api, fmt, useAsync, can, navigate } from '../lib.js';
import { Card, PageHeader, Loading, ErrorBox, Icon, Button, Alert, statusBadge, ScoreBadge, Empty } from '../ui.js';

function Stat({ icon, label, value, hint, href }) {
  return html`<a class="card stat" href=${href || undefined} style="text-decoration:none;color:inherit">
    <div class="label"><${Icon} name=${icon} cls="sm" />${label}</div>
    <div class="value">${value}</div>
    ${hint && html`<div class="hint">${hint}</div>`}
  </a>`;
}

function RevenueBars({ days }) {
  const max = Math.max(1, ...days.map((d) => Number(d.revenue)));
  return html`<div class="bars">
    ${days.map((d) => html`<div class="bar" title=${`${d.day}: ${fmt.money(d.revenue)} · ${d.orders} sifariş`}>
      <div style=${`height:${Math.max(2, (Number(d.revenue) / max) * 100)}%`}></div>
      <span>${d.day.slice(8)}</span>
    </div>`)}
  </div>`;
}

export function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.get('/dashboard'), []);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} onRetry=${reload} />`;
  const d = data;
  const hour = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baku' }));
  const greet = hour < 12 ? 'Sabahınız xeyir' : hour < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir';

  return html`<div class="stack">
    <${PageHeader} title=${`${greet}, ${d.user.full_name || d.user.username}!`} subtitle="Mağazanın bugünkü vəziyyəti">
      ${can('catalog') && html`<${Button} icon="add" variant="primary" onClick=${() => navigate('/products/new')}>Yeni məhsul</${Button}>`}
      ${can('inventory') && html`<${Button} icon="input" onClick=${() => navigate('/inventory/documents/new?type=receipt')}>Mədaxil</${Button}>`}
    </${PageHeader}>

    ${d.untrackedProducts > 0 && can('inventory') && html`<${Alert} type="info">
      <b>${d.untrackedProducts} məhsulda stok izlənmir</b> — sayt onları həmişə “stokda var” göstərir.
      Anbara mədaxil etdikdən sonra məhsulda <b>“Stoku izlə”</b> açarını aktivləşdirin.
      <a href="#/products?stock=untracked"> Siyahıya bax →</a>
    </${Alert}>`}

    <div class="grid grid-4">
      ${d.orders && html`
        <${Stat} icon="today" label="Bugünkü sifarişlər" value=${d.orders.today_count} hint=${fmt.money(d.orders.today_revenue)} href="#/orders" />
        <${Stat} icon="payments" label="30 günlük gəlir" value=${fmt.money(d.orders.month_revenue)} hint=${`${d.orders.month_count} sifariş`} href="#/orders" />
        <${Stat} icon="pending_actions" label="Açıq sifarişlər" value=${d.orders.open_count} hint=${`${d.orders.new_count} yeni`} href="#/orders?status=open" />`}
      ${d.catalog && html`<${Stat} icon="checkroom" label="Məhsullar" value=${d.catalog.published} hint=${`${d.catalog.drafts} qaralama`} href="#/products" />`}
      ${d.reviews && html`<${Stat} icon="reviews" label="Gözləyən rəylər" value=${d.reviews.pending} hint=${`Cəmi ${d.reviews.total} rəy`} href="#/reviews?status=pending" />`}
      ${d.messages && html`<${Stat} icon="mail" label="Oxunmamış müraciətlər" value=${d.messages.unread} href="#/messages?status=new" />`}
      ${d.seo && html`<${Stat} icon="travel_explore" label="Orta SEO balı" value=${`${d.seo.average}/100`} hint=${`${d.seo.images_without_alt} şəklin alt mətni yoxdur`} href="#/seo" />`}
    </div>

    <div class="grid grid-2">
      ${d.orders && html`<${Card} title="Son 14 günün gəliri" icon="bar_chart"><${RevenueBars} days=${d.orders.daily} /></${Card}>`}
      ${d.orders && html`<${Card} title="Son sifarişlər" icon="receipt_long" bodyClass="" actions=${html`<a class="btn sm" href="#/orders">Hamısı</a>`}>
        ${d.orders.recent.length ? html`<div class="table-wrap"><table class="table"><tbody>
          ${d.orders.recent.map((o) => html`<tr class="click" onClick=${() => navigate(`/orders/${o.id}`)}>
            <td class="mono">#${o.id}</td>
            <td><div class="name">${o.customer || '—'}</div><div class="sub">${fmt.ago(o.created_at)}</div></td>
            <td>${statusBadge(o.status)}</td>
            <td class="right nowrap"><b>${fmt.money(o.total)}</b></td>
          </tr>`)}
        </tbody></table></div>` : html`<${Empty} icon="receipt_long" title="Hələ sifariş yoxdur" />`}
      </${Card}>`}
      ${d.lowStock && html`<${Card} title="Az qalan / bitən stok" icon="warning" bodyClass="" actions=${html`<a class="btn sm" href="#/inventory?filter=low">Anbar</a>`}>
        ${d.lowStock.length ? html`<div class="table-wrap"><table class="table"><tbody>
          ${d.lowStock.map((v) => html`<tr class="click" onClick=${() => navigate(`/products/${v.product_id}?tab=variants`)}>
            <td><div class="name">${v.product_name}</div><div class="sub mono">${v.sku}</div></td>
            <td class="small">${[v.color_name || v.color, v.size].filter(Boolean).join(' / ')}</td>
            <td class="right"><span class="qty ${v.quantity <= 0 ? 'neg' : 'low'}">${v.quantity}</span></td>
          </tr>`)}
        </tbody></table></div>` : html`<${Empty} icon="inventory" title="Stok problemi yoxdur">İzlənən bütün məhsullar kifayət qədərdir.</${Empty}>`}
      </${Card}>`}
      ${d.orders && html`<${Card} title="Ən çox satılanlar (30 gün)" icon="trending_up" bodyClass="">
        ${d.orders.top.length ? html`<div class="table-wrap"><table class="table"><tbody>
          ${d.orders.top.map((t) => html`<tr><td class="name">${t.name}</td><td class="right">${t.qty} ədəd</td><td class="right"><b>${fmt.money(t.revenue)}</b></td></tr>`)}
        </tbody></table></div>` : html`<${Empty} icon="trending_up" title="Məlumat yoxdur" />`}
      </${Card}>`}
      ${d.seo && html`<${Card} title="SEO-su zəif məhsullar" icon="travel_explore" bodyClass="">
        <div class="table-wrap"><table class="table"><tbody>
          ${d.seo.weakest.map((p) => html`<tr class="click" onClick=${() => navigate(`/products/${p.id}?tab=seo`)}>
            <td class="name">${p.name}</td><td class="right"><${ScoreBadge} score=${p.score} /></td>
          </tr>`)}
        </tbody></table></div>
      </${Card}>`}
    </div>
  </div>`;
}
