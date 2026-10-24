// Lightweight rich-text editor (contenteditable). Output is sanitized on the server.
import { useEffect, useRef, useState } from 'preact/hooks';
import { html, toast } from './lib.js';
import { Icon } from './ui.js';
import { MediaPicker, bestUrl } from './media.js';

const TOOLS = [
  ['format_h2', 'Başlıq 2', () => document.execCommand('formatBlock', false, 'h2')],
  ['format_h3', 'Başlıq 3', () => document.execCommand('formatBlock', false, 'h3')],
  ['format_paragraph', 'Paraqraf', () => document.execCommand('formatBlock', false, 'p')],
  '|',
  ['format_bold', 'Qalın', () => document.execCommand('bold')],
  ['format_italic', 'Kursiv', () => document.execCommand('italic')],
  ['format_underlined', 'Altdan xətt', () => document.execCommand('underline')],
  '|',
  ['format_list_bulleted', 'Siyahı', () => document.execCommand('insertUnorderedList')],
  ['format_list_numbered', 'Nömrəli siyahı', () => document.execCommand('insertOrderedList')],
  ['format_quote', 'Sitat', () => document.execCommand('formatBlock', false, 'blockquote')],
  ['horizontal_rule', 'Ayırıcı xətt', () => document.execCommand('insertHorizontalRule')],
  '|',
  ['link', 'Link', () => {
    const url = prompt('Link ünvanı (https://… və ya səhifə.html):');
    if (url) document.execCommand('createLink', false, url);
  }],
  ['image', 'Şəkil', 'image'],
  ['format_clear', 'Formatı təmizlə', () => document.execCommand('removeFormat')],
  '|',
  ['undo', 'Geri al', () => document.execCommand('undo')],
  ['redo', 'İrəli', () => document.execCommand('redo')],
];

export function RichText({ value, onChange, placeholder = 'Mətni buraya yazın…' }) {
  const ref = useRef();
  const [source, setSource] = useState(false);
  const [picking, setPicking] = useState(false);
  const savedRange = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
  }, [value, source]);

  const emit = () => onChange(ref.current.innerHTML.replace(/^<br>$/, ''));

  function run(tool) {
    if (tool === 'image') {
      const sel = window.getSelection();
      savedRange.current = sel.rangeCount ? sel.getRangeAt(0) : null;
      setPicking(true);
      return;
    }
    ref.current.focus();
    tool();
    emit();
  }

  function insertImage(m) {
    setPicking(false);
    ref.current.focus();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    if (!m.alt) toast.info('Şəklin alt mətni yoxdur — SEO üçün media kitabxanasında əlavə edin.');
    const alt = String(m.alt || '').replace(/"/g, '&quot;');
    document.execCommand('insertHTML', false, `<img src="${bestUrl(m, 'large')}" alt="${alt}" loading="lazy">`);
    emit();
  }

  return html`<div class="rte">
    <div class="rte-bar">
      ${TOOLS.map((t) => (t === '|'
        ? html`<span class="sep"></span>`
        : html`<button type="button" title=${t[1]} disabled=${source} onMouseDown=${(e) => e.preventDefault()} onClick=${() => run(t[2])}><${Icon} name=${t[0]} /></button>`))}
      <span class="grow"></span>
      <button type="button" title=${source ? 'Vizual redaktor' : 'HTML kodu'} onClick=${() => setSource(!source)} style="width:auto;padding:0 8px;font-size:12px;font-weight:700">
        ${source ? 'Vizual' : 'HTML'}
      </button>
    </div>
    ${source
      ? html`<textarea class="rte-source" value=${value || ''} onInput=${(e) => onChange(e.currentTarget.value)}></textarea>`
      : html`<div ref=${ref} class="rte-area" contenteditable="true" data-placeholder=${placeholder}
          onInput=${emit}
          onPaste=${(e) => {
            // Paste as plain text paragraphs; avoids dragging foreign styles in.
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            const htmlText = text.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('');
            document.execCommand('insertHTML', false, htmlText);
            emit();
          }}></div>`}
    ${picking && html`<${MediaPicker} kind="image" onClose=${() => setPicking(false)} onPick=${(items) => insertImage(items[0])} />`}
  </div>`;
}
