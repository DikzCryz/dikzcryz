/* DikzCryz v7 - Sairi AI client. API key hanya berada di backend. */
(() => {
  const box = $('#aiMessages'), form = $('#aiForm'), input = $('#aiInput');
  if (!box || !form) return;
  const KEY = 'dz_sairi_history';
  let history = ls.get(KEY, []), busy = false, voiceMode = false;
  const endpoint = () => (ls.get('dz_ai_url', '') || '').replace(/\/$/, '');
  const session = () => { const s = sessGet(); return s && s.session; };
  const setStatus = (ok, text) => { const el = $('#aiStatus'); el.textContent = text; el.classList.toggle('ready', !!ok); };
  const save = () => ls.set(KEY, history.slice(-40).map(({role,text}) => ({role,text}))); // audio dibuat ulang bila diperlukan; blob URL tidak disimpan lintas sesi
  function render() {
    box.innerHTML = '';
    if (!history.length) {
      box.innerHTML = '<div class="ai-welcome"><b>Hai, aku Sairi.</b><p>Aku bisa bantu menjawab pertanyaan dan mengobrol. Kamu juga bisa meminta balasanku dibuat menjadi Voice Note.</p></div>';
      return;
    }
    history.forEach((m, i) => {
      const el = document.createElement('div'); el.className = 'ai-bubble ' + (m.role === 'user' ? 'user' : 'sairi');
      const label = document.createElement('small'); label.className = 'ai-label'; label.textContent = m.role === 'user' ? 'KAMU' : 'SAIRI'; el.appendChild(label);
      const body = document.createElement('div'); body.textContent = m.text; el.appendChild(body);
      if (m.role === 'assistant') {
        const actions = document.createElement('div'); actions.className = 'ai-actions';
        const vn = document.createElement('button'); vn.className = 'ai-action'; vn.textContent = m.audio ? 'Buat ulang VN' : 'Kirim sebagai VN'; vn.onclick = () => makeVoice(m.text, el, i); actions.appendChild(vn);
        if (m.audio) { const a = document.createElement('audio'); a.className = 'ai-audio'; a.controls = true; a.preload = 'none'; a.src = m.audio; el.appendChild(a); const speed = document.createElement('button'); speed.className='ai-action'; speed.textContent='Kecepatan 1x'; speed.onclick=()=>{a.playbackRate=a.playbackRate===1?1.5:a.playbackRate===1.5?2:1;speed.textContent='Kecepatan '+a.playbackRate+'x';}; actions.appendChild(speed); }
        el.appendChild(actions);
      }
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
  }
  function push(role, text, audio) { const m = { role, text, ...(audio ? {audio} : {}) }; history.push(m); save(); render(); return m; }
  async function request(path, body) {
    const url = endpoint(); if (!url) throw new Error('Atur alamat server AI di Menu > Pengaturan terlebih dahulu.');
    const s = session(); if (!s) throw new Error('Sesi aplikasi tidak ditemukan. Silakan masuk ulang.');
    const r = await fetch(url + path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...body, session:s}) });
    if (!r.ok) { let j={}; try{j=await r.json()}catch{} throw new Error(j.error || 'Server AI gagal ('+r.status+').'); }
    return r;
  }
  function typing() { const d=document.createElement('div'); d.className='ai-bubble sairi'; d.innerHTML='<small class="ai-label">SAIRI</small><span class="dots"><i></i><i></i><i></i></span>'; box.appendChild(d); box.scrollTop=box.scrollHeight; return d; }
  async function send(text) {
    if (busy || !text.trim()) return;
    busy=true; $('#aiForm button').disabled=true; push('user',text.trim()); const wait=typing();
    try {
      const prior=history.filter(x=>x.role==='user'||x.role==='assistant').slice(-13,-1).map(x=>({role:x.role,content:x.text}));
      const r=await request('/api/chat',{message:text.trim(),history:prior}); const j=await r.json(); wait.remove();
      if (!j.reply) throw new Error('Sairi belum mengirim jawaban.');
      push('assistant',j.reply);
      if (voiceMode) { const node=box.lastElementChild; const idx=history.length-1; await makeVoice(j.reply,node,idx,true); }
    } catch(e) { wait.remove(); toast(e.message); }
    finally { busy=false; $('#aiForm button').disabled=false; }
  }
  async function makeVoice(text, node, index, internal=false) {
    if (busy && !internal) return; const wasBusy=busy; busy=true;
    try {
      const r=await request('/api/voice',{text}); const blob=await r.blob();
      const old=history[index] && history[index].audio;
      if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
      const audio=URL.createObjectURL(blob); history[index].audio=audio; save(); render();
      const player=box.querySelectorAll('.ai-bubble.sairi')[Math.max(0,history.slice(0,index+1).filter(x=>x.role==='assistant').length-1)]?.querySelector('audio');
      if(player) player.play().catch(()=>{});
    } catch(e) { toast(e.message); }
    finally { busy=wasBusy; }
  }
  form.addEventListener('submit',e=>{e.preventDefault();const t=input.value.trim();if(!t)return;input.value='';input.style.height='auto';send(t);});
  input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,105)+'px';});
  $('#aiClear').onclick=()=>{history=[];save();render();};
  $('#aiVoiceMode').onclick=()=>{voiceMode=!voiceMode;$('#aiVoiceMode').textContent='Mode VN: '+(voiceMode?'aktif':'mati');toast(voiceMode?'Balasan baru akan dibuatkan VN':'Mode VN dimatikan');};
  $('#aiInput').addEventListener('focus',()=>setTimeout(()=>window.scrollTo(0,document.body.scrollHeight),180));
  render();
  const check=()=>{const ok=!!endpoint()&&!!session();setStatus(ok,ok?'SIAP':'ATUR SERVER');};
  check(); window.addEventListener('authed',check); window.addEventListener('page',e=>{if(e.detail==='ai')check();});
})();
