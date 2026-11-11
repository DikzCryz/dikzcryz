(function () {
  const box = $('#eqBox'); let S = null;
  const dB = v => (v / 100).toFixed(1) + ' dB';
  const hz = h => h >= 1000 ? (h / 1000) + ' kHz' : h + ' Hz';
  const call = (fn, ...a) => { try { return JSON.parse(N[fn](...a)); } catch (e) { return null; } };

  function load() {
    if (!N) { box.innerHTML = '<div class="neo card">Equalizer hanya aktif di dalam aplikasi Android.</div>'; return; }
    S = call('eqState'); render();
  }

  function slider(id, label, min, max, val, ok, fmt) {
    return `<div class="eqrow"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" value="${val}" ${ok ? '' : 'disabled'}><b id="${id}v">${ok ? fmt(val) : 'n/a'}</b></div>`;
  }

  function render() {
    if (!S || !S.ok) {
      box.innerHTML = `<div class="neo card rv in">Equalizer tidak tersedia di HP ini (efek audio global ditolak sistem).<br><br>
        <button class="btn" id="eqSys">Buka equalizer sistem</button></div>`;
      const b = $('#eqSys'); if (b) b.onclick = () => N.openSystemEq();
      return;
    }
    const bands = S.bands.map((b, i) => slider('eb' + i, hz(b.hz), S.min, S.max, b.lv, true, dB)).join('');
    const chips = S.presets.map((p, i) => `<button class="chip ${S.preset === i ? 'on' : ''}" data-p="${i}">${esc(p)}</button>`).join('');
    box.innerHTML = `
      <div class="neo card"><div class="row between"><b>Equalizer ${S.on ? 'aktif' : 'mati'}</b><button class="swt ${S.on ? 'on' : ''}" id="eqOn" aria-label="Aktifkan"></button></div>
        <small>Berlaku untuk YouTube dan aplikasi musik lain. Hasil bisa beda tiap HP.</small></div>
      <div class="neo card"><b>Preset</b><div class="chips">${chips}</div></div>
      <div class="neo card"><b>Band</b>${bands}</div>
      <div class="neo card"><b>Efek</b>
        ${slider('eBass', 'Bass', 0, 1000, S.bass, S.bassOk, v => Math.round(v / 10) + '%')}
        ${slider('eVirt', '3D', 0, 1000, S.virt, S.virtOk, v => Math.round(v / 10) + '%')}
        ${slider('eLoud', 'Volume+', 0, 1000, S.loud, S.loudOk, v => (v / 100).toFixed(1) + ' dB')}
      </div>
      <button class="btn wide" id="eqSys">Buka equalizer sistem</button>`;

    $('#eqOn').onclick = () => { S = call('eqEnable', !S.on) || S; render(); };
    $('#eqSys').onclick = () => N.openSystemEq();
    $$('.chip', box).forEach(c => c.onclick = () => { S = call('eqPreset', +c.dataset.p) || S; render(); });
    S.bands.forEach((_, i) => {
      const el = $('#eb' + i);
      el.oninput = () => { N.eqBand(i, +el.value); $('#eb' + i + 'v').textContent = dB(+el.value); $$('.chip.on', box).forEach(c => c.classList.remove('on')); };
    });
    const bind = (id, fn, fmt) => { const el = $('#' + id); el.oninput = () => { N[fn](+el.value); $('#' + id + 'v').textContent = fmt(+el.value); }; };
    bind('eBass', 'eqBass', v => Math.round(v / 10) + '%');
    bind('eVirt', 'eqVirt', v => Math.round(v / 10) + '%');
    bind('eLoud', 'eqLoud', v => (v / 100).toFixed(1) + ' dB');
  }

  window.addEventListener('page', e => { if (e.detail === 'eq') load(); });
})();
