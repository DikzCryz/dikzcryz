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
const DEV_WA = '6281717445134';

let baseCfg = { yt: '', sbUrl: '', sbKey: '' };
try { if (N) baseCfg = JSON.parse(N.config()); } catch (e) {}
let over = ls.get('dz_cfg', {});
const C = () => ({
  yt: over.yt || baseCfg.yt,
  wa: over.wa || DEV_WA,
  sbUrl: baseCfg.sbUrl || '',
  sbKey: baseCfg.sbKey || ''
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
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  dots: '<path d="M12 5v.01M12 12v.01M12 19v.01" stroke-width="3.6"/>',
  chevd: '<path d="M6 9l6 6 6-6"/>',
  like: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
  queue: '<path d="M4 6h12M4 11h12M4 16h7M17 14v6M14 17h6"/>',
  popup: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="12" width="7" height="5" rx="1"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
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
const PAGES = ['home', 'chat', 'yt', 'eq', 'me'];
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
  if (window.__ytBack && window.__ytBack()) return true;
  if (cur !== 'home') { go('home'); return true; }
  return false;
};

/* ===== boot ===== */
/* ===== background (wallpaper) yang bisa diganti user ===== */
function applyBg() {
  const d = ls.get('dz_bg', '');
  const root = document.documentElement.style;
  if (d) root.setProperty('--wall', 'url("' + d + '")'); else root.removeProperty('--wall');
  const pv = $('#bgPrev'); if (pv) pv.style.backgroundImage = d ? 'url("' + d + '")' : 'url("hero.jpg")';
}
function setupBg() {
  $('#bgPick').onclick = () => $('#bgIn').click();
  $('#bgReset').onclick = () => { try { localStorage.removeItem('dz_bg'); } catch (e) {} applyBg(); toast('Background kembali ke bawaan'); };
  $('#bgIn').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const im = new Image(), url = URL.createObjectURL(f);
    im.onload = () => {
      const k = Math.min(1, 1080 / im.width, 2400 / im.height);
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const data = c.toDataURL('image/jpeg', .82);
      try { localStorage.setItem('dz_bg', JSON.stringify(data)); applyBg(); toast('Background diganti'); }
      catch (err) { toast('Gambar terlalu besar, pilih yang lain'); }
    };
    im.onerror = () => toast('Gambar tidak bisa dibaca');
    im.src = url; e.target.value = '';
  });
  applyBg();
}

function boot() {
  // biar YouTube / pemutar tidak menganggap halaman "tersembunyi" saat app di background
  try {
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
  } catch (e) {}

  paint();
  setupBg();
  setTheme(ls.get('dz_theme', 'green'));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $('#menuBtn').onclick = () => sideOpen(true);
  $('#sideClose').onclick = () => sideOpen(false);
  $('#scrim').onclick = () => sideOpen(false);
  $('#siAbout').onclick = () => $('#aboutBox').classList.toggle('open');
  $$('.sw-t').forEach(b => b.onclick = () => setTheme(b.dataset.t));

  $('#siSet').onclick = () => {
    $('#sYt').value = over.yt || ''; $('#sWa').value = over.wa || '';
    sideOpen(false); sheetOpen(true);
  };
  $('#sheetClose').onclick = () => sheetOpen(false);
  $('#sSave').onclick = () => {
    over = { yt: $('#sYt').value.trim(), wa: $('#sWa').value.replace(/\D/g, '') };
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

  // layar loading singkat (logo + bar); setelah itu gerbang token (video berulang) kalau belum masuk
  const sp = $('#splash');
  typeText($('#splashTitle'), 'DikzCryz', 140);
  const bar = $('#sbar'); bar.style.transition = 'width 2.6s linear';
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; }));
  setTimeout(() => {
    sp.classList.add('out'); setTimeout(() => sp.remove(), 700);
    typeText($('#brand'), 'DikzCryz', 110);
  }, 2800);
  gate.start();
}
