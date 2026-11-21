(function () {
  const list = $('#chat'), inp = $('#chatIn'), form = $('#chatForm');
  let room = 'group', last = 0, timer = null, busy = false, token = 0;

  const rid = () => { const s = sessGet(); return room === 'group' ? 'group' : 'dm:' + (s && s.id); };
  const empty = () => room === 'group'
    ? 'Belum ada pesan. Jadilah yang pertama menyapa!'
    : 'Tulis pesan untuk admin/developer. Chat ini hanya bisa dilihat kamu dan admin.';
  function bubble(m) {
    const d = document.createElement('div');
    d.className = 'msg ' + (m.mine ? 'u' : 'm');
    d.innerHTML = (m.mine ? '' : `<small class="who">${esc(m.author)}${m.is_admin ? ' <span class="tag">Admin</span>' : ''}</small>`) + esc(m.body);
    return d;
  }
  const nearBottom = () => (document.documentElement.scrollHeight - window.scrollY - window.innerHeight) < 160;

  async function poll(full) {
    const s = sessGet(); if (!s) return;
    const my = token;
    try {
      const j = await rpc('chat_get', { p_session: s.session, p_room: rid(), p_after: full ? 0 : last });
      if (my !== token) return;                       // ruang diganti saat menunggu
      if (full) { list.innerHTML = ''; last = 0; }
      if (full && !j.length) { list.innerHTML = `<div class="note">${esc(empty())}</div>`; return; }
      if (!j.length) return;
      const stick = full || nearBottom();
      if (!full && list.querySelector('.note')) list.innerHTML = '';
      j.forEach(m => list.appendChild(bubble(m)));
      last = j[j.length - 1].id;
      if (stick) list.lastElementChild.scrollIntoView({ block: 'end' });
    } catch (e) {
      if (e.net) return;
      if (/Sesi tidak valid|Akses dicabut|Token/.test(e.message)) { gate.kick(e.message); return; }
      if (full) list.innerHTML = `<div class="note">${esc(e.message)}</div>`;
    }
  }
  function start() { stop(); poll(true); timer = setInterval(() => poll(false), window.DZ_PERF && window.DZ_PERF.light ? 6000 : 3000); }
  function stop() { clearInterval(timer); timer = null; }
  function setRoom(r) {
    room = r; token++; last = 0;
    $$('#chatTabs button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
    list.innerHTML = ''; start();
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const text = inp.value.trim(); const s = sessGet();
    if (!text || busy || !s) return;
    busy = true;
    try {
      await rpc('chat_send', { p_session: s.session, p_room: rid(), p_body: text });
      inp.value = ''; inp.style.height = 'auto';
      await poll(false);
      const l = list.lastElementChild; if (l) l.scrollIntoView({ block: 'end' });
    } catch (e) {
      if (/Sesi tidak valid|Akses dicabut/.test(e.message)) gate.kick(e.message); else toast(e.message);
    }
    busy = false;
  });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 110) + 'px'; });
  $('#chatTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setRoom(b.dataset.r === 'dm' ? 'dm' : 'group'); });
  window.addEventListener('page', e => { if (e.detail === 'chat') start(); else stop(); });
})();
