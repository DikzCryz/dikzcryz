/* Akses lewat token + panggilan ke server (Supabase RPC) */
const rpc = async (fn, body) => {
  const c = C();
  if (!c.sbUrl || !c.sbKey) { const e = new Error('Server belum dikonfigurasi pada build ini.'); e.cfg = true; throw e; }
  let r;
  try {
    r = await fetch(c.sbUrl + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: c.sbKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err) { const x = new Error('Tidak ada koneksi internet.'); x.net = true; throw x; }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error((j && (j.message || j.error_description || j.error)) || ('Error ' + r.status));
  return j;
};
const sessGet = () => ls.get('dz_sess', null);

const gate = (() => {
  const el = () => $('#gate');
  const msg = (t, err) => { const m = $('#gateMsg'); m.textContent = t; m.classList.toggle('err', !!err); };
  function open() {
    el().classList.add('out');
    setTimeout(() => { el().classList.add('hide'); try { $('#gateVid').pause(); } catch (e) {} }, 520);
    window.dispatchEvent(new CustomEvent('authed'));
  }
  function show(t, err) {
    el().classList.remove('hide', 'out');
    try { const p = $('#gateVid').play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    if (t) msg(t, err);
  }
  function deviceId() {
    if (N && N.deviceId) return N.deviceId();
    let d = ls.get('dz_dev', null);
    if (!d) { d = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set('dz_dev', d); }
    return d;
  }
  async function submit(e) {
    e.preventDefault();
    const name = $('#gName').value.trim(), token = $('#gToken').value.trim();
    if (!name || !token) { msg('Isi nama dan token dulu ya.', true); return; }
    const b = $('#gBtn'); b.disabled = true; b.textContent = 'Memeriksa...'; msg('Memeriksa token...');
    try {
      const j = await rpc('activate', { p_token: token, p_device: deviceId(), p_name: name });
      ls.set('dz_sess', { session: j.session, name: j.name, id: j.id, ok: Date.now() });
      open();
    } catch (err) { msg(err.message, true); }
    finally { b.disabled = false; b.textContent = 'Masuk'; }
  }
  async function start() {
    $('#gateForm').addEventListener('submit', submit);
    $('#gWa').onclick = () => {
      const n = C().wa;
      if (!n) { toast('Nomor WA developer belum diatur'); return; }
      const u = 'https://wa.me/' + n + '?text=' + encodeURIComponent('Halo, saya mau beli token DikzCryz.');
      if (N) N.openUrl(u); else window.open(u, '_blank');
    };
    const s = sessGet();
    if (!s) { show(); return; }
    try {
      await rpc('whoami', { p_session: s.session });
      s.ok = Date.now(); ls.set('dz_sess', s); open();
    } catch (e) {
      if (e.net && s.ok && Date.now() - s.ok < 3 * 864e5) { open(); return; }   // offline: boleh masuk maks. 3 hari
      if (!e.net && !e.cfg) ls.set('dz_sess', null);
      show(e.message, true);
    }
  }
  function kick(t) { ls.set('dz_sess', null); show(t || 'Silakan masuk lagi.', true); }
  return { start, kick };
})();
