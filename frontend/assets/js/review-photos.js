/* Bodi.az — customer review photos: picker (with client-side downscale), thumbnails and lightbox. */
(function (global) {
  "use strict";
  const MAX_FILES = 4;
  const MAX_BYTES = 8 * 1024 * 1024;
  const MAX_EDGE = 1600;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // Downscale big phone photos before upload (faster on mobile data). Falls back to the original file
  // when the browser cannot decode it (e.g. HEIC outside Safari) — the server validates either way.
  async function shrink(file) {
    if (!global.createImageBitmap || file.size < 600 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      bmp.close && bmp.close();
      const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch (e) { return file; }
  }

  /** Inserts a photo picker into `form` before `beforeEl`. Returns { files(), reset() }. */
  function mount(form, beforeEl) {
    let files = [];
    const box = document.createElement("div");
    box.className = "rp-picker";
    box.innerHTML = `
      <label class="block font-label-md text-label-md text-on-surface mb-1">Şəkillər <span class="text-on-surface-variant font-normal">(istəyə görə, ən çox ${MAX_FILES})</span></label>
      <div class="rp-grid">
        <button type="button" class="rp-add" aria-label="Şəkil əlavə et">
          <span class="material-symbols-outlined">add_a_photo</span><span>Şəkil əlavə et</span>
        </button>
      </div>
      <input type="file" accept="image/*" multiple class="sr-only" tabindex="-1" aria-hidden="true">
      <p class="rp-hint">Məhsulun körpənizin əynində necə göründüyünü paylaşın. Şəkillər moderasiyadan sonra dərc olunur.</p>`;
    form.insertBefore(box, beforeEl);
    const grid = box.querySelector(".rp-grid");
    const add = box.querySelector(".rp-add");
    const input = box.querySelector("input[type=file]");
    const urls = new Map();

    function render() {
      grid.querySelectorAll(".rp-thumb").forEach(n => n.remove());
      files.forEach((f, i) => {
        if (!urls.has(f)) urls.set(f, URL.createObjectURL(f));
        const t = document.createElement("div");
        t.className = "rp-thumb";
        t.innerHTML = `<img src="${urls.get(f)}" alt="Seçilmiş şəkil ${i + 1}"><button type="button" aria-label="Şəkli sil"><span class="material-symbols-outlined">close</span></button>`;
        t.querySelector("button").addEventListener("click", () => { URL.revokeObjectURL(urls.get(f)); urls.delete(f); files.splice(i, 1); render(); });
        grid.insertBefore(t, add);
      });
      add.classList.toggle("hidden", files.length >= MAX_FILES);
    }
    add.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const picked = Array.from(input.files || []);
      input.value = "";
      for (const f of picked) {
        if (files.length >= MAX_FILES) { STORE.toast(`Ən çox ${MAX_FILES} şəkil əlavə edə bilərsiniz`, "info"); break; }
        if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { STORE.toast("Yalnız şəkil faylları seçin", "warning"); continue; }
        const small = await shrink(f);
        if (small.size > MAX_BYTES) { STORE.toast("Şəkil 8 MB-dan böyükdür", "warning"); continue; }
        files.push(small);
      }
      render();
    });
    return {
      files: () => files.slice(),
      reset: () => { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); files = []; render(); }
    };
  }

  /** Thumbnail strip for a review (empty string when there are no photos). */
  function strip(review, size) {
    const imgs = (review && review.images) || [];
    if (!imgs.length) return "";
    const key = "rp" + (review.id || Math.random().toString(36).slice(2));
    registry[key] = imgs;
    return `<div class="rp-strip ${size === "sm" ? "rp-strip-sm" : ""}" data-rp="${key}">${imgs.map((im, i) =>
      `<button type="button" class="rp-strip-item" data-rp-open="${i}" aria-label="Şəkli böyüt (${i + 1}/${imgs.length})"><img src="${esc(im.thumb)}" alt="Müştəri şəkli ${i + 1}" loading="lazy" decoding="async" draggable="false"></button>`).join("")}</div>`;
  }
  const registry = {};

  // Lightbox
  let lb, lbImg, lbCount, current = [], idx = 0;
  function ensureLightbox() {
    if (lb) return;
    lb = document.createElement("div");
    lb.className = "rp-lightbox hidden";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Müştəri şəkli");
    lb.innerHTML = `<button type="button" class="rp-lb-close" aria-label="Bağla"><span class="material-symbols-outlined">close</span></button>
      <button type="button" class="rp-lb-nav rp-lb-prev" aria-label="Əvvəlki"><span class="material-symbols-outlined">chevron_left</span></button>
      <img alt="Müştəri şəkli">
      <button type="button" class="rp-lb-nav rp-lb-next" aria-label="Növbəti"><span class="material-symbols-outlined">chevron_right</span></button>
      <span class="rp-lb-count"></span>`;
    document.body.appendChild(lb);
    lbImg = lb.querySelector("img");
    lbCount = lb.querySelector(".rp-lb-count");
    lb.addEventListener("click", e => {
      if (e.target.closest(".rp-lb-prev")) return show(idx - 1);
      if (e.target.closest(".rp-lb-next")) return show(idx + 1);
      if (e.target === lb || e.target.closest(".rp-lb-close")) close();
    });
    document.addEventListener("keydown", e => {
      if (lb.classList.contains("hidden")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
    let x0 = null;
    lb.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1)); x0 = null; });
  }
  function show(i) {
    idx = (i + current.length) % current.length;
    lbImg.src = current[idx].full;
    lbCount.textContent = current.length > 1 ? `${idx + 1} / ${current.length}` : "";
    lb.querySelectorAll(".rp-lb-nav").forEach(b => b.classList.toggle("hidden", current.length < 2));
  }
  function open(images, i) {
    ensureLightbox();
    current = images; show(i || 0);
    lb.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    lb.querySelector(".rp-lb-close").focus();
  }
  function close() { lb.classList.add("hidden"); document.body.style.overflow = ""; }

  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-rp-open]");
    if (!btn) return;
    const box = btn.closest("[data-rp]");
    const imgs = box && registry[box.getAttribute("data-rp")];
    if (!imgs) return;
    e.preventDefault(); e.stopPropagation();
    open(imgs, Number(btn.getAttribute("data-rp-open")));
  }, true);

  global.BODI_REVIEW_PHOTOS = { mount, strip, open, MAX_FILES };
})(window);
