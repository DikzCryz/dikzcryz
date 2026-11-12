/* ===== util ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dec = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
const N = window.Native || null;
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* Nomor WA developer (format 628xxxxxxxxxx). Bisa juga diisi lewat Sidebar > Pengaturan. */
const DEV_WA = '';

let baseCfg = { yt: '', gemini: '' };
try { if (N) baseCfg = JSON.parse(N.config()); } catch (e) {}
let over = ls.get('dz_cfg', {});
const C = () => ({
  yt: over.yt || baseCfg.yt,
  gemini: over.gemini || baseCfg.gemini,
  model: over.model || 'gemini-flash-latest',
  wa: over.wa || DEV_WA
});

/* ===== icon SVG (tanpa emoji) ===== */
const IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  ai: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  yt: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
  eq: '<path d="M5 4v6M5 14v6M12 4v2M12 10v10M19 4v9M19 17v3"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="15" r="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  menu: '<path d="M4 7h16M4 12h10M4 17h16"/>',
  x: '<path d="M5 5l14 14M19 5L5 19"/>',
  send: '<path d="M3 11l18-8-8 18-2-7z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.6-2-.5-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
};
const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;
const paint = (root = document) => $$('[data-ico]', root).forEach(e => { e.innerHTML = ico(e.dataset.ico); });

/* ===== toast ===== */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ===== animasi ketik ===== */
function typeText(el, text, speed = 120) {
  el.textContent = ''; el.classList.add('typing'); let i = 0;
  const id = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) { clearInterval(id); setTimeout(() => el.classList.remove('typing'), 1500); }
  }, speed);
}

/* ===== reveal saat scroll ===== */
let io;
function reveal() {
  if (!io) io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 });
  $$('.rv:not(.in)').forEach(e => io.observe(e));
}

/* ===== navigasi ===== */
const PAGES = ['home', 'ai', 'yt', 'eq', 'me'];
let cur = 'home';
function go(p) {
  cur = p;
  document.body.dataset.page = p;
  $$('.page').forEach(e => e.classList.toggle('active', e.id === 'page-' + p));
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === p));
  $('#ind').style.transform = `translateX(${PAGES.indexOf(p) * 100}%)`;
  window.scrollTo(0, 0);
  window.dispatchEvent(new CustomEvent('page', { detail: p }));
  reveal();
}

/* ===== sidebar ===== */
const sideOpen = v => document.body.classList.toggle('side-open', v);
const sheetOpen = v => $('#sheet').classList.toggle('open', v);

/* ===== tema ===== */
function setTheme(t) {
  document.body.dataset.theme = t; ls.set('dz_theme', t);
  $$('.sw-t').forEach(b => b.classList.toggle('on', b.dataset.t === t));
}

window.__back = () => {
  if ($('#sheet').classList.contains('open')) { sheetOpen(false); return true; }
  if (document.body.classList.contains('side-open')) { sideOpen(false); return true; }
  if (cur !== 'home') { go('home'); return true; }
  return false;
};

/* ===== boot ===== */
function boot() {
  // biar YouTube / pemutar tidak menganggap halaman "tersembunyi" saat app di background
  try {
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
  } catch (e) {}

  paint();
  setTheme(ls.get('dz_theme', 'green'));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $('#menuBtn').onclick = () => sideOpen(true);
  $('#sideClose').onclick = () => sideOpen(false);
  $('#scrim').onclick = () => sideOpen(false);
  $('#siAbout').onclick = () => $('#aboutBox').classList.toggle('open');
  $$('.sw-t').forEach(b => b.onclick = () => setTheme(b.dataset.t));

  $('#siSet').onclick = () => {
    $('#sYt').value = over.yt || ''; $('#sGem').value = over.gemini || '';
    $('#sModel').value = over.model || ''; $('#sWa').value = over.wa || '';
    sideOpen(false); sheetOpen(true);
  };
  $('#sheetClose').onclick = () => sheetOpen(false);
  $('#sSave').onclick = () => {
    over = { yt: $('#sYt').value.trim(), gemini: $('#sGem').value.trim(), model: $('#sModel').value.trim(), wa: $('#sWa').value.replace(/\D/g, '') };
    ls.set('dz_cfg', over); sheetOpen(false); toast('Pengaturan disimpan');
  };
  const wa = () => {
    const n = C().wa;
    if (!n) { toast('Nomor WA developer belum diatur'); return; }
    const u = 'https://wa.me/' + n + '?text=' + encodeURIComponent('Halo, saya pakai DikzCryz. ');
    if (N) N.openUrl(u); else window.open(u, '_blank');
  };
  $('#siWa').onclick = wa; $('#pWa').onclick = wa;

  go('home');
  reveal();

  // layar loading: video intro.mp4 (selesai saat video habis); kalau tidak ada video, 8 detik
  const sp = $('#splash'), v = $('#introVid');
  let closed = false;
  const closeSplash = () => {
    if (closed) return; closed = true;
    sp.classList.add('out'); setTimeout(() => sp.remove(), 700);
    typeText($('#brand'), 'DikzCryz', 110);
  };
  const fallback = () => {
    v.remove(); sp.classList.remove('has-video');
    typeText($('#splashTitle'), 'DikzCryz', 150);
    const bar = $('#sbar'); bar.style.transition = 'width 8s linear';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; }));
    setTimeout(closeSplash, 8000);
  };
  sp.classList.add('has-video');
  v.onerror = fallback;
  v.onended = closeSplash;
  v.play && v.play().catch(() => {});
  setTimeout(closeSplash, 14000);
}
