// SEO panel: fields, Google result preview and live analysis.
import { useEffect, useState } from 'preact/hooks';
import { html, api, useDebounced } from './lib.js';
import { Field, Input, Textarea, Switch, Counter, Card, Icon } from './ui.js';
import { MediaUrlField } from './media.js';

const SITE = 'https://bodi.az';

export function SerpPreview({ title, description, url }) {
  return html`<div class="serp">
    <div class="site"><span class="fav">B</span><div>Bodi.az<small>${url.replace(/^https?:\/\//, '').replace(/\?/, ' › ')}</small></div></div>
    <div class="t">${title || 'Başlıq'}</div>
    <div class="d">${description || 'Meta təsvir yazılmayıb — Google səhifədən təsadüfi mətn göstərəcək.'}</div>
  </div>`;
}

function ScoreRing({ score }) {
  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warn)' : 'var(--danger)';
  const bg = score >= 80 ? 'var(--success-soft)' : score >= 50 ? 'var(--warn-soft)' : 'var(--danger-soft)';
  return html`<div class="score-ring" style=${`background:${bg};color:${color};box-shadow:inset 0 0 0 3px ${color}`}>${score}</div>`;
}

/**
 * value: { title, description, keywords, focus_keyword, canonical, og_image, noindex }
 * auto:  { title, description } generated defaults shown as placeholders
 */
export function SeoPanel({ value = {}, onChange, auto = {}, slug, path, content, images = [], kind = 'product' }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const effectiveTitle = value.title || auto.title || '';
  const effectiveDesc = value.description || auto.description || '';
  const url = value.canonical || `${SITE}/${path}${slug || ''}`;
  const [analysis, setAnalysis] = useState(null);
  const payload = useDebounced(JSON.stringify({
    kind, title: effectiveTitle, description: effectiveDesc, slug, content, focus_keyword: value.focus_keyword,
    images: images.map((i) => ({ alt: i.alt || '' })),
  }), 500);

  useEffect(() => {
    let alive = true;
    api.post('/seo/analyze', JSON.parse(payload)).then((r) => alive && setAnalysis(r)).catch(() => {});
    return () => { alive = false; };
  }, [payload]);

  return html`<div class="stack">
    <${Card} title="Google axtarış önizləməsi" icon="travel_explore">
      <${SerpPreview} title=${effectiveTitle} description=${effectiveDesc} url=${url} />
    </${Card}>
    <${Card} title="SEO məlumatları" icon="tune">
      <div class="stack">
        <${Field} label="Fokus açar söz" help="Bu səhifənin Google-da tapılmasını istədiyiniz əsas ifadə (məs: “körpə bodisi”).">
          <${Input} value=${value.focus_keyword} onInput=${(v) => set('focus_keyword', v)} placeholder="körpə bodisi" />
        </${Field}>
        <${Field} label="SEO başlığı" counter=${html`<${Counter} value=${effectiveTitle} min=${30} max=${60} />`}
          help=${auto.title && !value.title ? 'Boş saxlasanız avtomatik başlıq istifadə olunur.' : ''}>
          <${Input} value=${value.title} onInput=${(v) => set('title', v)} placeholder=${auto.title} maxLength="120" />
        </${Field}>
        <${Field} label="Meta təsvir" counter=${html`<${Counter} value=${effectiveDesc} min=${110} max=${160} />`}>
          <${Textarea} rows="3" value=${value.description} onInput=${(v) => set('description', v)} placeholder=${auto.description} maxLength="320" />
        </${Field}>
        <${Field} label="Açar sözlər" help="Vergüllə ayırın. Yandex və daxili axtarış üçün faydalıdır.">
          <${Input} value=${value.keywords} onInput=${(v) => set('keywords', v)} placeholder="körpə geyimi, orqanik pambıq, bodi" />
        </${Field}>
        <details>
          <summary class="label" style="cursor:pointer">Əlavə parametrlər</summary>
          <div class="stack mt">
            <${Field} label="Canonical URL" help="Yalnız eyni məzmun başqa ünvanda da varsa doldurun.">
              <${Input} value=${value.canonical} onInput=${(v) => set('canonical', v)} placeholder=${`${SITE}/${path}${slug || ''}`} />
            </${Field}>
            <${Field} label="Sosial şəbəkə şəkli (OpenGraph)" help="WhatsApp, Facebook, Telegram paylaşımlarında görünən şəkil. Boşdursa əsas şəkil istifadə olunur.">
              <${MediaUrlField} value=${value.og_image} onChange=${(v) => set('og_image', v)} />
            </${Field}>
            <${Switch} checked=${value.noindex} onChange=${(v) => set('noindex', v)} label="Axtarış motorlarından gizlət (noindex)" sub="Səhifə saytda qalır, amma Google-da göstərilmir və sitemap-dan çıxarılır." />
          </div>
        </details>
      </div>
    </${Card}>
    <${Card} title="SEO analizi" icon="insights">
      ${analysis ? html`<div class="row" style="align-items:flex-start;gap:14px">
        <${ScoreRing} score=${analysis.score} />
        <ul class="seo-checks grow">
          ${analysis.checks.map((c) => html`<li class=${c.level}><span class="dot"></span><span>${c.text}</span></li>`)}
        </ul>
      </div>` : html`<div class="small muted"><${Icon} name="hourglass_empty" cls="sm" /> Analiz edilir…</div>`}
    </${Card}>
  </div>`;
}
