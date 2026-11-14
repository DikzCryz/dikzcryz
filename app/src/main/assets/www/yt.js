(function () {
  const feed = $('#ytGrid'), pw = $('#pw'), spacer = $('#ySpacer');
  const API = 'https://www.googleapis.com/youtube/v3/';
  const TABS = { music: { cat: 10, q: 'musik terbaru' }, news: { cat: 25, q: 'berita terkini' }, game: { cat: 20, q: 'gameplay' } };
  let mode = 'home', list = [], ctx = [], queue = [], nextArr = [], auto = true, menuV = null;
  let curV = null, active = false, view = 'feed', feedLoaded = false, comLoaded = false;
  let P = null, ready = false, pending = null, ticker = null, loadingApi = false, seeking = false, tickN = 0;
  const chCache = {};
  let prog = ls.get('dz_prog', {});
  const page = () => document.body.dataset.page;

  /* ---------- format ---------- */
  const num = n => {
    n = +n; if (!isFinite(n)) return '';
    const f = (x, u) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toString().replace('.', ',') + ' ' + u;
    if (n < 1000) return String(n);
    if (n < 1e6) return f(n / 1e3, 'rb');
    if (n < 1e9) return f(n / 1e6, 'jt');
    return f(n / 1e9, 'M');
  };
  function ago(iso, long) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000; if (!(s >= 0)) return '';
    const U = long ? [[31536000, 'tahun'], [2592000, 'bulan'], [604800, 'minggu'], [86400, 'hari'], [3600, 'jam'], [60, 'menit']]
                   : [[31536000, 'thn'], [2592000, 'bln'], [604800, 'mgg'], [86400, 'hari'], [3600, 'jam'], [60, 'mnt']];
    for (const [d, u] of U) if (s >= d) return Math.floor(s / d) + ' ' + u + (long ? ' yang lalu' : ' lalu');
    return 'baru saja';
  }
  function dur(iso) {
    const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
    if (!m) return { t: '', s: 0 };
    const sec = ((((+m[1] || 0) * 24) + (+m[2] || 0)) * 60 + (+m[3] || 0)) * 60 + (+m[4] || 0);
    if (!sec) return { t: '', s: 0 };
    const h = Math.floor(sec / 3600), mi = Math.floor(sec % 3600 / 60), se = sec % 60;
    return { t: (h ? h + ':' + String(mi).padStart(2, '0') : mi) + ':' + String(se).padStart(2, '0'), s: sec };
  }
  const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const metaLine = v => {
    const p = [v.c];
    if (v.views != null) p.push(num(v.views) + ' x ditonton');
    if (v.pub) p.push(ago(v.pub));
    return p.join(' • ');
  };

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
  const mapV = it => {
    const sn = it.snippet || {}, cd = it.contentDetails || {}, st = it.statistics || {};
    const id = typeof it.id === 'string' ? it.id : (it.id.videoId || '');
    const d = dur(cd.duration), th = sn.thumbnails || {};
    return {
      id, t: dec(sn.title || ''), c: dec(sn.channelTitle || ''), ci: sn.channelId || '',
      img: (th.maxres && th.maxres.url) || ('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'),
      dur: sn.liveBroadcastContent === 'live' ? 'LIVE' : d.t, sec: d.s,
      views: st.viewCount != null ? +st.viewCount : null,
      likes: st.likeCount != null ? +st.likeCount : null,
      pub: sn.publishedAt || '', desc: sn.description || ''
    };
  };
  async function attachCh(items) {
    const need = [...new Set(items.map(v => v.ci).filter(c => c && !chCache[c]))];
    for (let i = 0; i < need.length; i += 50) {
      try {
        const j = await api('channels', { part: 'snippet,statistics', id: need.slice(i, i + 50).join(',') });
        (j.items || []).forEach(c => {
          chCache[c.id] = {
            img: ((c.snippet.thumbnails || {}).default || {}).url || '',
            subs: c.statistics && !c.statistics.hiddenSubscriberCount ? +c.statistics.subscriberCount : null
          };
        });
      } catch (e) {}
    }
    items.forEach(v => { const c = chCache[v.ci]; if (c) v.cimg = c.img; });
    return items;
  }
  async function chart(cat) {
    const p = { part: 'snippet,contentDetails,statistics', chart: 'mostPopular', regionCode: 'ID', maxResults: 30 };
    if (cat) p.videoCategoryId = cat;
    const j = await api('videos', p);
    return attachCh((j.items || []).map(mapV));
  }
  async function searchV(extra) {
    const j = await api('search', Object.assign({ part: 'snippet', type: 'video', maxResults: 25 }, extra));
    const ids = (j.items || []).map(i => i.id && i.id.videoId).filter(Boolean);
    if (!ids.length) return [];
    const d = await api('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') });
    const by = {}; (d.items || []).forEach(it => { by[it.id] = mapV(it); });
    return attachCh(ids.map(i => by[i]).filter(Boolean));
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hist = () => ls.get('dz_hist', []);
  const addHist = v => { const o = Object.assign({}, v, { desc: '' }); ls.set('dz_hist', [o, ...hist().filter(x => x.id !== v.id)].slice(0, 100)); };
  function saveProg() {
    const k = Object.keys(prog); if (k.length > 300) k.slice(0, k.length - 300).forEach(x => delete prog[x]);
    ls.set('dz_prog', prog);
  }
  const pct = id => { const p = prog[id] || 0; return p >= 2 ? Math.min(100, p) : 0; };

  /* ---------- feed ---------- */
  function setTab(m) { $$('#ytTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); }
  const av = v => v.cimg ? `<img class="av" src="${esc(v.cimg)}" alt="">` : `<span class="av ph">${esc((v.c || '?').charAt(0).toUpperCase())}</span>`;
  function thumb(v) {
    const p = pct(v.id);
    return `<div class="yth"><img loading="lazy" src="${esc(v.img)}" alt="">${v.dur ? `<span class="dur">${esc(v.dur)}</span>` : ''}${p ? `<i class="pbar" style="width:${p}%"></i>` : ''}</div>`;
  }
  function draw() {
    if (!list.length) { feed.innerHTML = '<div class="neo note">Belum ada video.</div>'; return; }
    feed.innerHTML = list.map((v, i) => `<div class="yv" data-i="${i}" style="animation-delay:${Math.min(i, 6) * 40}ms">${thumb(v)}<div class="ymeta">${av(v)}<div class="ytx"><b>${esc(v.t)}</b><small>${esc(metaLine(v))}</small></div><button class="ydots" data-d="${i}" aria-label="Menu">${ico('dots')}</button></div></div>`).join('');
  }
  async function load(m, q) {
    mode = m; setTab(m);
    feed.innerHTML = '<div class="skel"></div><div class="skel"></div>';
    try {
      let items;
      if (m === 'hist') items = hist();
      else if (m === 'search') items = await searchV({ q });
      else if (m === 'short') items = await searchV({ q: (q || 'musik') + ' #shorts', videoDuration: 'short' });
      else if (m === 'mix') items = await searchV({ q: 'mix nonstop' });
      else if (m === 'home') items = shuffle(await chart());
      else {
        try { items = await chart(TABS[m].cat); if (!items.length) throw new Error('kosong'); }
        catch (e) { items = await searchV({ q: TABS[m].q }); }
      }
      list = items; draw();
    } catch (e) { feed.innerHTML = `<div class="neo note">${esc(e.message)}</div>`; }
  }
  feed.addEventListener('click', e => {
    const d = e.target.closest('.ydots'); if (d) { menu(list[+d.dataset.d], mode === 'hist'); return; }
    const c = e.target.closest('.yv'); if (c) play(list[+c.dataset.i], list);
  });
  $('#ytTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) load(b.dataset.m, b.dataset.m === 'short' ? $('#ytQ').value.trim() : ''); });

  /* ---------- menu titik tiga ---------- */
  function menu(v, inHist) {
    menuV = v;
    $('#ymenuCard').innerHTML = `<div class="mi title">${esc(v.t)}</div>
      <button class="mi" data-a="queue">${ico('queue')}Tambah ke antrean</button>
      <button class="mi" data-a="share">${ico('share')}Bagikan</button>
      <button class="mi" data-a="open">${ico('ext')}Buka di YouTube</button>
      ${inHist ? `<button class="mi" data-a="del">${ico('trash')}Hapus dari histori</button>` : ''}`;
    $('#ymenu').classList.add('open');
  }
  const closeMenu = () => $('#ymenu').classList.remove('open');
  $('#ymenu').addEventListener('click', e => {
    if (e.target.id === 'ymenu') { closeMenu(); return; }
    const b = e.target.closest('[data-a],[data-rate],[data-q]'); if (!b) return;
    if (b.dataset.rate) { setRate(+b.dataset.rate); closeMenu(); return; }
    if (b.dataset.q != null) {
      const v = nextArr[+b.dataset.q]; closeMenu();
      if (v) { queue = queue.filter(x => x.id !== v.id); play(v, ctx); }
      return;
    }
    const act = b.dataset.a;
    if (act === 'rate') { openRate(); return; }
    if (act === 'auto') { toggleAuto(); openSet(); return; }
    if (act === 'loop') { loop = !loop; openSet(); return; }
    if (!menuV) return;
    const v = menuV; closeMenu();
    if (act === 'queue') addQ(v);
    else if (act === 'share') share(v);
    else if (act === 'open') openYt(v);
    else if (act === 'del') { ls.set('dz_hist', hist().filter(x => x.id !== v.id)); if (mode === 'hist') { list = hist(); draw(); } }
  });
  function addQ(v) {
    if (curV && curV.id === v.id) { toast('Video ini sedang diputar'); return; }
    if (queue.some(q => q.id === v.id)) { toast('Sudah ada di antrean'); return; }
    queue.push(v); toast('Ditambah ke antrean'); if (active && view === 'watch') renderNext();
  }
  function share(v) {
    const t = v.t + '\nhttps://youtu.be/' + v.id;
    if (N && N.share) N.share(t);
    else if (navigator.share) navigator.share({ text: t }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast('Tautan disalin'));
  }
  function openYt(v) {
    const u = 'https://www.youtube.com/watch?v=' + v.id;
    if (N) N.openUrl(u); else window.open(u, '_blank');
  }

  /* ---------- halaman nonton ---------- */
  const statLine = v => [v.views != null ? v.views.toLocaleString('id-ID') + ' tampilan' : '', v.pub ? ago(v.pub, true) : ''].filter(Boolean).join(' • ');
  function renderHead() {
    const v = curV; if (!v) return;
    $('#wTitle').textContent = v.t;
    $('#wStat').textContent = statLine(v);
    $('#wLikeN').textContent = v.likes != null ? num(v.likes) : '-';
    $('#wDesc').textContent = v.desc || 'Tidak ada deskripsi.';
    $('#wChan').textContent = v.c;
    const ch = chCache[v.ci];
    $('#wSubs').textContent = ch && ch.subs != null ? num(ch.subs) + ' subscriber' : '';
    const im = $('#wAv'), ph = $('#wAvPh');
    ph.textContent = (v.c || '?').charAt(0).toUpperCase();
    if (v.cimg) { im.src = v.cimg; im.classList.remove('hide'); ph.classList.add('hide'); }
    else { im.classList.add('hide'); ph.classList.remove('hide'); }
  }
  function upNext() {
    const i = ctx.findIndex(x => x.id === curV.id);
    const rest = i >= 0 ? ctx.slice(i + 1).concat(ctx.slice(0, i)) : ctx.slice();
    return rest.filter(x => x.id !== curV.id).slice(0, 40);
  }
  function renderNext() {
    const q = queue.slice(), r = upNext().filter(x => !q.some(y => y.id === x.id));
    nextArr = q.concat(r);
    $('#wNext').innerHTML = nextArr.length ? nextArr.map((v, i) => `<div class="yrel" data-i="${i}">${thumb(v)}<div class="ytx"><b>${i < q.length ? '<span class="tag">Antrean</span>' : ''}${esc(v.t)}</b><small>${esc(metaLine(v))}</small></div><button class="ydots" data-d="${i}" aria-label="Menu">${ico('dots')}</button></div>`).join('')
      : '<div class="note">Belum ada video berikutnya.</div>';
  }
  $('#wNext').addEventListener('click', e => {
    const d = e.target.closest('.ydots'); if (d) { menu(nextArr[+d.dataset.d], false); return; }
    const c = e.target.closest('.yrel'); if (!c) return;
    const v = nextArr[+c.dataset.i]; queue = queue.filter(x => x.id !== v.id); play(v, ctx);
  });
  async function detail(v) {
    try {
      const j = await api('videos', { part: 'snippet,contentDetails,statistics', id: v.id });
      const it = (j.items || [])[0]; if (!it) return;
      const n = mapV(it);
      Object.assign(v, { views: n.views, likes: n.likes, desc: n.desc, pub: n.pub || v.pub, sec: n.sec || v.sec, dur: n.dur || v.dur, ci: n.ci || v.ci, c: n.c || v.c });
      await attachCh([v]);
      if (curV === v) renderHead();
    } catch (e) {}
  }
  async function loadComments() {
    const box = $('#wComs'); box.innerHTML = '<div class="cm">Memuat...</div>'; const v = curV;
    try {
      const j = await api('commentThreads', { part: 'snippet', videoId: v.id, order: 'relevance', maxResults: 20, textFormat: 'plainText' });
      if (curV !== v) return;
      const it = j.items || [];
      box.innerHTML = it.length ? it.map(c => {
        const s = c.snippet.topLevelComment.snippet;
        return `<div class="cm"><small>${esc(dec(s.authorDisplayName))} • ${esc(ago(s.publishedAt))}${s.likeCount ? ' • ' + esc(num(s.likeCount)) + ' suka' : ''}</small>${esc(s.textDisplay)}</div>`;
      }).join('') : '<div class="cm">Belum ada komentar.</div>';
      comLoaded = true;
    } catch (e) {
      box.innerHTML = '<div class="cm">' + esc(/disabled/i.test(e.message) ? 'Komentar dimatikan untuk video ini.' : e.message) + '</div>';
    }
  }
  $('#wMore').onclick = () => { $('#wDesc').classList.toggle('hide'); $('#wMore').classList.toggle('open'); };
  $('#wComBtn').onclick = () => { const b = $('#wComs'); b.classList.toggle('hide'); if (!b.classList.contains('hide') && !comLoaded) loadComments(); };
  function toggleAuto() { auto = !auto; $('#wAuto').classList.toggle('on', auto); }
  $('#wAuto').onclick = toggleAuto;
  $('#aShare').onclick = () => curV && share(curV);
  $('#aOpen').onclick = () => curV && openYt(curV);
  $('#aPop').onclick = () => { if (active) { view = 'feed'; decideMode(); } };

  /* ---------- mode tampilan player ---------- */
  function decideMode() {
    const onYt = page() === 'yt', watch = active && view === 'watch' && onYt;
    $('#yFeed').classList.toggle('hide', watch);
    $('#yWatch').classList.toggle('hide', !watch);
    pw.classList.remove('big', 'mini');
    if (active) pw.classList.add(watch ? 'big' : 'mini');
    spacer.classList.toggle('on', watch);
    document.body.classList.toggle('mini-on', active && !watch);
    if (!watch) setFs(false);
  }
  function expand() { view = 'watch'; if (page() !== 'yt') go('yt'); else decideMode(); }
  window.addEventListener('page', e => {
    if (e.detail !== 'yt' && active) view = 'feed';
    if (e.detail === 'yt' && !feedLoaded) { feedLoaded = true; load('home'); }
    decideMode();
  });
  window.__ytBack = () => {
    if ($('#ymenu').classList.contains('open')) { closeMenu(); return true; }
    if (!$('#sview').classList.contains('hide')) { closeSearch(); return true; }
    if (fs) { setFs(false); return true; }
    if (page() === 'yt' && active && view === 'watch') { view = 'feed'; decideMode(); return true; }
    return false;
  };

  /* ---------- player ---------- */
  function ensureApi() {
    if (P || loadingApi) return; loadingApi = true;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { loadingApi = false; toast('Gagal memuat pemutar YouTube'); };
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
    playing = e.data === 1;
    pw.classList.toggle('playing', playing);
    const ic = ico(playing ? 'pause' : 'play');
    $('#mPlay').innerHTML = ic; $('#pcenter').innerHTML = ic;
    if (playing) {
      try { if (P.getPlaybackRate && P.getPlaybackRate() !== rate) P.setPlaybackRate(rate); } catch (x) {}
      showCtl();
    } else showCtl(true);
    if (e.data === 2) saveProg();
    if (e.data === 0 && curV) {
      prog[curV.id] = 100; saveProg();
      if (loop) { P.seekTo(0, true); P.playVideo(); } else next();
    }
  }
  function loadVideo(v) {
    const p = pct(v.id), start = (p >= 3 && p < 95 && v.sec) ? Math.floor(v.sec * p / 100) : 0;
    const o = { videoId: v.id, startSeconds: start };
    if (ready) P.loadVideoById(o); else { pending = o; ensureApi(); }
  }
  function play(v, src, fromPrev) {
    if (!v) return;
    if (curV && !fromPrev && curV.id !== v.id) { backStack.push(curV); if (backStack.length > 30) backStack.shift(); }
    curV = v; if (src) ctx = src; active = true; view = 'watch'; comLoaded = false;
    addHist(v);
    $('#mtitle').textContent = v.t; $('#mchan').textContent = v.c;
    renderHead(); renderNext();
    $('#wDesc').classList.add('hide'); $('#wMore').classList.remove('open');
    $('#wComs').classList.add('hide'); $('#wComs').innerHTML = '';
    if (page() !== 'yt') go('yt'); else decideMode();
    loadVideo(v);
    clearInterval(ticker); ticker = setInterval(tick, 500);
    detail(v);
    window.scrollTo(0, 0);
  }
  function next() {
    if (queue.length) { play(queue.shift(), ctx); return; }
    if (!auto || !curV) return;
    const l = upNext(); if (l.length) play(l[0], ctx);
  }
  function tick() {
    if (!ready || !P || !P.getDuration || !curV || seeking) return;
    const d = P.getDuration(), t = P.getCurrentTime();
    $('#tcur').textContent = fmtT(t); $('#tdur').textContent = fmtT(d);
    const sv0 = d ? Math.round(t / d * 1000) : 0;
    $('#seek').value = sv0; $('#seek').style.setProperty('--p', (sv0 / 10) + '%');
    if (d > 0 && P.getPlayerState && P.getPlayerState() === 1) {
      const p = Math.min(100, Math.round(t / d * 100));
      if (p !== prog[curV.id]) { prog[curV.id] = p; if (++tickN % 10 === 0) saveProg(); }
    }
  }
  const toggle = () => { if (!ready) return; P.getPlayerState() === 1 ? P.pauseVideo() : P.playVideo(); };
  $('#mtxt').onclick = expand;
  $('#mPlay').onclick = toggle;
  $('#mClose').onclick = () => {
    if (ready) P.stopVideo(); saveProg();
    active = false; curV = null; clearInterval(ticker); pw.classList.remove('playing'); decideMode();
  };
  const seek = $('#seek');
  seek.addEventListener('input', () => { seeking = true; seek.style.setProperty('--p', (seek.value / 10) + '%'); showCtl(true); });
  seek.addEventListener('change', () => { if (ready) P.seekTo(P.getDuration() * seek.value / 1000, true); seeking = false; showCtl(); });

  /* ---------- kontrol player (overlay) ---------- */
  let playing = false, ctlT = null, fs = false, loop = false, backStack = [];
  let rate = +ls.get('dz_rate', 1) || 1;
  const fmtRate = r => (r === 1 ? '1' : String(r)) + 'x';
  $('#cRate').textContent = fmtRate(rate);

  function showCtl(stick) {
    pw.classList.add('ctl'); clearTimeout(ctlT);
    if (!stick && playing) ctlT = setTimeout(() => pw.classList.remove('ctl'), 3000);
  }
  $('#shield').onclick = () => {
    if (pw.classList.contains('mini')) { expand(); return; }
    if (pw.classList.contains('ctl') && playing) { pw.classList.remove('ctl'); clearTimeout(ctlT); } else showCtl();
  };
  // klik pada tombol kontrol tidak boleh ikut menyembunyikan overlay
  $('#pctrl').addEventListener('click', e => { if (e.target !== $('#pctrl')) { e.stopPropagation(); showCtl(playing ? false : true); } });

  function prev() {
    if (!ready || !curV) return;
    if (P.getCurrentTime() > 3 || !backStack.length) { P.seekTo(0, true); return; }
    play(backStack.pop(), ctx, true);
  }
  function nextManual() {
    if (queue.length) { play(queue.shift(), ctx); return; }
    const l = curV ? upNext() : [];
    if (l.length) play(l[0], ctx); else toast('Tidak ada video berikutnya');
  }
  function setFs(on) {
    if (fs === on) return;
    fs = on; pw.classList.toggle('fs', on);
    if (N && N.setFullscreen) N.setFullscreen(on);
    $('#cFull').innerHTML = ico(on ? 'fullx' : 'full');
  }
  function setRate(r) {
    rate = r; ls.set('dz_rate', r); $('#cRate').textContent = fmtRate(r);
    try { if (ready && P.setPlaybackRate) P.setPlaybackRate(r); } catch (e) {}
  }
  function openSheet(html) { $('#ymenuCard').innerHTML = html; $('#ymenu').classList.add('open'); }
  function openRate() {
    let rs = [0.5, 0.75, 1, 1.25, 1.5, 2];
    try { const a = P.getAvailablePlaybackRates(); if (a && a.length) rs = a; } catch (e) {}
    openSheet('<div class="mi title">Kecepatan</div>' + rs.map(r => `<button class="mi" data-rate="${r}">${r === rate ? '• ' : ''}${r === 1 ? 'Normal' : r + 'x'}</button>`).join(''));
  }
  function openSet() {
    openSheet(`<div class="mi title">Pengaturan pemutar</div>
      <button class="mi" data-a="rate">Kecepatan<span class="sp"></span><small>${rate === 1 ? 'Normal' : rate + 'x'}</small></button>
      <button class="mi" data-a="auto">Antrean otomatis<span class="sp"></span><small>${auto ? 'Aktif' : 'Mati'}</small></button>
      <button class="mi" data-a="loop">Ulangi video<span class="sp"></span><small>${loop ? 'Aktif' : 'Mati'}</small></button>`);
  }
  function openQueue() {
    if (!curV) return; renderNext();
    const rows = nextArr.slice(0, 15).map((v, i) => `<button class="mi" data-q="${i}"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700">${i < queue.length ? '<span class="tag">Antrean</span>' : ''}${esc(v.t)}</span></button>`).join('');
    openSheet('<div class="mi title">Antrean &amp; berikutnya</div>' + (rows || '<div class="mi">Belum ada video berikutnya.</div>'));
  }
  $('#cPrev').onclick = prev;
  $('#cNext').onclick = nextManual;
  $('#pcenter').onclick = toggle;
  $('#cClose').onclick = () => { view = 'feed'; decideMode(); };
  $('#cRate').onclick = openRate;
  $('#cQ').onclick = openQueue;
  $('#cSet').onclick = openSet;
  $('#cFull').onclick = () => setFs(!fs);

  /* ---------- pencarian layar penuh ---------- */
  const sv = $('#sview'), sQ = $('#sQ'), sList = $('#sList');
  let sugs = [], sugId = 0, sugT = null;
  const shist = () => ls.get('dz_sh', []);
  const addSh = q => ls.set('dz_sh', [q, ...shist().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 30));
  const srow = (i, t) => `<div class="srow" data-q="${esc(t)}"><span class="sic">${ico(i)}</span><span class="st">${esc(t)}</span><button type="button" class="snw" data-fill="${esc(t)}" aria-label="Isi kolom">${ico('nw')}</button></div>`;
  function renderS() {
    const q = sQ.value.trim().toLowerCase();
    const h = shist().filter(x => !q || x.toLowerCase().includes(q)).slice(0, q ? 3 : 10);
    const seen = new Set(h.map(x => x.toLowerCase()));
    const s2 = sugs.filter(x => !seen.has(x.toLowerCase())).slice(0, 10);
    sList.innerHTML = h.map(x => srow('hist', x)).concat(s2.map(x => srow('search', x))).join('')
      + (!q && h.length ? '<div class="srow clr" id="sClr">Hapus riwayat</div>' : '');
  }
  function fetchSug(q) {
    q = q.trim();
    if (!q) { sugs = []; sugId++; renderS(); return; }
    const id = ++sugId;
    if (N && N.suggest) N.suggest(q, String(id));
    else fetch('https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=id&q=' + encodeURIComponent(q))
      .then(r => r.json()).then(j => window.__sug(String(id), j[1])).catch(() => {});
  }
  window.__sug = (id, arr) => {
    if (+id !== sugId) return;
    sugs = Array.isArray(arr) ? arr.map(String) : [];
    if (!sv.classList.contains('hide')) renderS();
  };
  function openSearch() {
    sv.classList.remove('hide'); sQ.value = $('#ytQ').value; sugs = []; renderS();
    setTimeout(() => { sQ.focus(); try { sQ.setSelectionRange(sQ.value.length, sQ.value.length); } catch (e) {} }, 60);
    if (sQ.value.trim()) fetchSug(sQ.value);
  }
  function closeSearch() { sv.classList.add('hide'); sQ.blur(); }
  function doSearch(q) {
    q = (q || '').trim(); if (!q) return;
    addSh(q); $('#ytQ').value = q; closeSearch(); load('search', q);
  }
  $('#ytForm').addEventListener('click', openSearch);
  $('#sBack').onclick = closeSearch;
  $('#sClear').onclick = () => { sQ.value = ''; sugs = []; sugId++; renderS(); sQ.focus(); };
  $('#sform').addEventListener('submit', e => { e.preventDefault(); doSearch(sQ.value); });
  sQ.addEventListener('input', () => { renderS(); clearTimeout(sugT); sugT = setTimeout(() => fetchSug(sQ.value), 180); });
  sList.addEventListener('click', e => {
    if (e.target.closest('#sClr')) { ls.set('dz_sh', []); renderS(); return; }
    const f = e.target.closest('.snw');
    if (f) { sQ.value = f.dataset.fill; renderS(); fetchSug(sQ.value); sQ.focus(); return; }
    const r = e.target.closest('.srow'); if (r && r.dataset.q) doSearch(r.dataset.q);
  });
})();
