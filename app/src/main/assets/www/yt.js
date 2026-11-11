(function () {
  const grid = $('#ytGrid'), pw = $('#pw'), spacer = $('#ySpacer');
  const API = 'https://www.googleapis.com/youtube/v3/';
  let mode = 'home', list = [], idx = -1, active = false;
  let P = null, ready = false, pending = null, ticker = null, loading = false;

  /* ---------- data ---------- */
  async function api(path, params) {
    const k = C().yt;
    if (!k) throw new Error('API key YouTube belum diisi. Isi di Sidebar > Pengaturan.');
    const u = new URL(API + path);
    Object.entries(params).forEach(([a, b]) => u.searchParams.set(a, b));
    u.searchParams.set('key', k);
    const r = await fetch(u); const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || ('Error ' + r.status));
    return j;
  }
  const norm = it => ({
    id: typeof it.id === 'string' ? it.id : it.id.videoId,
    t: dec(it.snippet.title), c: dec(it.snippet.channelTitle),
    img: (it.snippet.thumbnails.medium || it.snippet.thumbnails.default).url
  });
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hist = () => ls.get('dz_hist', []);
  const addHist = v => { ls.set('dz_hist', [v, ...hist().filter(x => x.id !== v.id)].slice(0, 100)); };

  async function load(m, q) {
    mode = m; $$('#ytSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    grid.innerHTML = '<div class="neo note">Memuat...</div>';
    try {
      if (m === 'hist') list = hist();
      else if (m === 'short') list = (await api('search', { part: 'snippet', type: 'video', videoDuration: 'short', maxResults: 25, q: (q || 'musik') + ' #shorts' })).items.map(norm);
      else if (m === 'search') list = (await api('search', { part: 'snippet', type: 'video', maxResults: 25, q })).items.map(norm);
      else list = shuffle((await api('videos', { part: 'snippet', chart: 'mostPopular', regionCode: 'ID', maxResults: 30 })).items.map(norm));
      draw();
    } catch (e) { grid.innerHTML = `<div class="neo note">${esc(e.message)}</div>`; }
  }
  function draw() {
    if (!list.length) { grid.innerHTML = '<div class="neo note">Belum ada video.</div>'; return; }
    grid.innerHTML = list.map((v, i) => `<button class="neo vcard" data-i="${i}" style="animation-delay:${Math.min(i, 8) * 40}ms"><img loading="lazy" src="${esc(v.img)}" alt=""><div><b>${esc(v.t)}</b><small>${esc(v.c)}</small></div></button>`).join('');
  }
  grid.addEventListener('click', e => { const b = e.target.closest('.vcard'); if (b) play(+b.dataset.i); });
  $('#ytForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#ytQ').value.trim(); if (q) { $('#ytQ').blur(); load('search', q); } });
  $('#ytSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) load(b.dataset.m, b.dataset.m === 'short' ? $('#ytQ').value.trim() : ''); });

  /* ---------- player ---------- */
  function ensureApi() {
    if (P || loading) return; loading = true;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { loading = false; toast('Gagal memuat pemutar YouTube'); };
    document.head.appendChild(s);
  }
  window.onYouTubeIframeAPIReady = () => {
    P = new YT.Player('yt', {
      width: '100%', height: '100%',
      playerVars: { controls: 0, modestbranding: 1, rel: 0, playsinline: 1, fs: 0, disablekb: 1, iv_load_policy: 3, origin: location.origin },
      events: {
        onReady: () => { ready = true; if (pending) { P.loadVideoById(pending); pending = null; } },
        onStateChange: onState,
        onError: e => toast('Video tidak bisa diputar (kode ' + e.data + ')')
      }
    });
  };
  function onState(e) {
    const playing = e.data === 1;
    pw.classList.toggle('playing', playing);
    $('#mPlay').innerHTML = ico(playing ? 'pause' : 'play');
    if (e.data === 0) next();
  }
  function setMode(m) {
    pw.removeAttribute('style'); pw.classList.remove('big', 'mini'); if (m) pw.classList.add(m);
    spacer.classList.toggle('on', m === 'big');
  }
  function play(i) {
    idx = i; const v = list[i]; if (!v) return;
    addHist(v); active = true; $('#ptitle').textContent = v.t;
    setMode('big'); go('yt');
    if (ready) P.loadVideoById(v.id); else { pending = v.id; ensureApi(); }
    clearInterval(ticker); ticker = setInterval(tick, 500);
  }
  function next() { if (idx + 1 < list.length) play(idx + 1); }
  const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  let seeking = false;
  function tick() {
    if (!ready || !P || !P.getDuration || seeking) return;
    const d = P.getDuration(), t = P.getCurrentTime();
    $('#tcur').textContent = fmtT(t); $('#tdur').textContent = fmtT(d);
    $('#seek').value = d ? Math.round(t / d * 1000) : 0;
  }
  const toggle = () => { if (!ready) return; P.getPlayerState() === 1 ? P.pauseVideo() : P.playVideo(); };
  $('#shield').onclick = toggle;
  $('#mPlay').onclick = e => { e.stopPropagation(); toggle(); };
  $('#mOpen').onclick = e => { e.stopPropagation(); go('yt'); };
  $('#mClose').onclick = e => { e.stopPropagation(); if (ready) P.stopVideo(); active = false; clearInterval(ticker); setMode(''); };
  const seek = $('#seek');
  seek.addEventListener('input', () => { seeking = true; });
  seek.addEventListener('change', () => { if (ready) P.seekTo(P.getDuration() * seek.value / 1000, true); seeking = false; });

  window.addEventListener('page', e => { if (active) setMode(e.detail === 'yt' ? 'big' : 'mini'); });
  window.addEventListener('page', e => { if (e.detail === 'yt' && !list.length) load('home'); });

  /* mini player bisa digeser */
  let drag = null;
  pw.addEventListener('touchstart', e => {
    if (!pw.classList.contains('mini') || e.target.closest('button')) return;
    const t = e.touches[0], r = pw.getBoundingClientRect(); drag = { dx: t.clientX - r.left, dy: t.clientY - r.top };
  }, { passive: true });
  pw.addEventListener('touchmove', e => {
    if (!drag) return; const t = e.touches[0];
    pw.style.left = Math.max(0, Math.min(innerWidth - pw.offsetWidth, t.clientX - drag.dx)) + 'px';
    pw.style.top = Math.max(0, Math.min(innerHeight - pw.offsetHeight, t.clientY - drag.dy)) + 'px';
    pw.style.right = 'auto'; pw.style.bottom = 'auto'; e.preventDefault();
  }, { passive: false });
  pw.addEventListener('touchend', () => { drag = null; });
})();
