(function () {
  const list = $('#chat'), inp = $('#chatIn'), form = $('#chatForm');
  let hist = ls.get('dz_chat', []);
  let busy = false;
  const SYS = 'Kamu adalah asisten AI di aplikasi DikzCryz. Jawab dengan bahasa yang dipakai pengguna, singkat, jelas, dan ramah.';

  function fmt(t) {
    let s = esc(t);
    s = s.replace(/```([\s\S]*?)```/g, (m, c) => '<pre>' + c.replace(/^\w*\n/, '') + '</pre>');
    return s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  }
  function add(role, text) {
    const d = document.createElement('div');
    d.className = 'msg ' + (role === 'user' ? 'u' : 'm');
    d.innerHTML = fmt(text);
    list.appendChild(d); d.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return d;
  }
  function renderAll() {
    list.innerHTML = '';
    if (!hist.length) add('model', 'Hai! Tanya apa saja, saya siap bantu.');
    hist.forEach(m => add(m.role, m.text));
  }

  async function ask() {
    const c = C();
    if (!c.gemini) throw new Error('API key Gemini belum diisi. Isi di Sidebar > Pengaturan.');
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 60000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.gemini },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYS }] },
          contents: hist.slice(-20).map(m => ({ role: m.role, parts: [{ text: m.text }] }))
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || ('Error ' + r.status));
      const t = (((j.candidates || [])[0] || {}).content || {}).parts;
      const out = t ? t.map(p => p.text || '').join('') : '';
      if (!out) throw new Error('AI tidak memberi jawaban (mungkin diblokir filter). Coba ulangi dengan kata lain.');
      return out;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('AI terlalu lama merespons. Coba lagi.');
      throw e;
    } finally { clearTimeout(to); }
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const text = inp.value.trim(); if (!text || busy) return;
    busy = true; inp.value = ''; inp.style.height = 'auto';
    if (!hist.length) list.innerHTML = '';
    hist.push({ role: 'user', text }); add('user', text);
    const typing = add('model', ''); typing.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    try {
      const out = await ask();
      hist.push({ role: 'model', text: out });
      typing.innerHTML = fmt(out);
    } catch (e) {
      typing.innerHTML = fmt('Gagal: ' + e.message);
    }
    hist = hist.slice(-40); ls.set('dz_chat', hist);
    typing.scrollIntoView({ block: 'end', behavior: 'smooth' });
    busy = false;
  });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 110) + 'px'; });
  $('#chatClear').onclick = () => { hist = []; ls.set('dz_chat', hist); renderAll(); toast('Chat dihapus'); };
  renderAll();
})();
