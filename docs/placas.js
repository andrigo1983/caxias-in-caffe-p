(async function () {
  document.getElementById('print').addEventListener('click', () => window.print());
  const base = new URL('index.html', location.href).href;
  const cafes = await (await fetch('data/cafes.json')).json();
  const box = document.getElementById('plaques');
  for (const c of cafes) {
    const p = document.createElement('div'); p.className = 'plaque';
    const logo = document.createElement('img'); logo.src = 'img/logo.png'; logo.alt = ''; logo.className = 'plaque-logo';
    const t = document.createElement('p'); t.className = 'plaque-title'; t.textContent = 'Faça seu check-in aqui!';
    const q = document.createElement('div'); q.className = 'qr';
    const n = document.createElement('p'); n.className = 'plaque-cafe'; n.textContent = c.name;
    const h = document.createElement('p'); h.className = 'plaque-help'; h.textContent = 'TESTE · Aponte a câmera do celular para o QR Code.';
    p.append(logo, t, q, n, h); box.append(p);
    const url = base + '#/checkin?c=' + encodeURIComponent(c.slug) + '&k=demo';
    if (window.QRCode) new QRCode(q, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    else { const a = document.createElement('a'); a.href = url; a.textContent = 'Gerador de QR indisponível (sem internet) — link de teste'; q.append(a); }
  }
})();
