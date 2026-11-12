(function () {
  let p = ls.get('dz_profile', { name: '', bio: '', photo: '' });
  const show = () => {
    $('#pName').value = p.name || ''; $('#pBio').value = p.bio || '';
    const img = $('#avImg');
    if (p.photo) { img.src = p.photo; img.style.display = 'block'; $('#avIco').style.display = 'none'; }
    else { img.style.display = 'none'; $('#avIco').style.display = 'block'; }
  };
  const pick = () => $('#photoIn').click();
  $('#photoBtn').addEventListener('click', pick);
  $('#avatar').addEventListener('click', pick);
  $('#photoIn').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const im = new Image(), url = URL.createObjectURL(f);
    im.onload = () => {
      const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
      const m = Math.min(im.width, im.height);
      c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, s, s);
      p.photo = c.toDataURL('image/jpeg', .85); URL.revokeObjectURL(url);
      ls.set('dz_profile', p); show(); toast('Foto diperbarui');
    };
    im.onerror = () => toast('Foto tidak bisa dibaca');
    im.src = url; e.target.value = '';
  });
  $('#pSave').onclick = () => {
    p.name = $('#pName').value.trim(); p.bio = $('#pBio').value.trim();
    ls.set('dz_profile', p); toast('Profil disimpan');
  };
  show();
})();
