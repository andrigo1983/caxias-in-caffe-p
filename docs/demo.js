/* Caxias in Caffè 2026 — VERSÃO DE DEMONSTRAÇÃO (GitHub Pages)
 * Funciona sem servidor: dados das cafeterias em data/cafes.json (somente informações públicas)
 * e o "passaporte" fica salvo apenas no localStorage deste aparelho. Nada é enviado a servidores.
 * A versão oficial (pasta app/) usa login Google, banco MySQL e validações no servidor. */
(async function () {
  const KEY = 'cic_demo_v1', CAXIAS = [-29.1678, -51.1794];
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  let cafes = [], scanner = null, map = null, myPos = null;

  /* ---------- utilidades (DOM seguro: textContent) ---------- */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return n;
  }
  const mount = (...n) => { document.getElementById('view').replaceChildren(...n); window.scrollTo(0, 0); };
  const alertBox = (m, t) => el('p', { class: 'alert ' + (t || '') }, m);
  const fmtDate = s => s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const safeUrl = u => { try { const x = new URL(u, location.href); return ['https:', 'http:'].includes(x.protocol) ? x.href : null; } catch { return null; } };
  const initials = n => String(n).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const avatar = (c, cls) => el('div', { class: 'avatar ph ' + (cls || ''), 'aria-hidden': 'true' }, initials(c.name));
  const kpi = (n, t) => el('div', { class: 'kpi' }, el('span', {}, n), t);
  const route = () => { const [p, q] = (location.hash.replace(/^#/, '') || '/').split('?'); return { path: p, params: Object.fromEntries(new URLSearchParams(q || '')) }; };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { user: null, visits: [] }; } catch { return { user: null, visits: [] }; } };
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const visitedSet = () => new Set(load().visits.map(v => v.slug));
  const goal = () => cafes.length;
  function locate(opts = {}) {
    return new Promise((ok, no) => {
      if (!navigator.geolocation) return no(new Error('Sem localização'));
      navigator.geolocation.getCurrentPosition(p => ok(p.coords), no, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000, ...opts });
    });
  }
  function requireLogin(after) {
    if (load().user) return true;
    sessionStorage.setItem('after_login', after || location.hash); location.hash = '#/login'; return false;
  }
  function stopAll() { if (scanner) { scanner.stop().catch(() => {}); scanner = null; } if (map) { map.remove(); map = null; } }

  function buildMap(node, list) {
    if (!window.L) { node.replaceChildren(alertBox('Mapa indisponível (sem internet).')); return; }
    map = L.map(node, { scrollWheelZoom: false }).setView(CAXIAS, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const vis = visitedSet(), pts = [];
    list.filter(c => c.lat !== null).forEach(c => {
      L.circleMarker([c.lat, c.lng], { radius: 10, weight: 3, color: '#fff', fillOpacity: 1, fillColor: vis.has(c.slug) ? '#2e7d32' : '#8a4b24' }).addTo(map)
        .bindPopup(el('div', { class: 'pop' }, el('b', {}, c.name), el('br'), el('a', { href: '#/cafe?slug=' + encodeURIComponent(c.slug) }, 'Ver detalhes')));
      pts.push([c.lat, c.lng]);
    });
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    const mine = map;
    locate().then(p => { if (map !== mine) return; myPos = [p.latitude, p.longitude];
      L.circleMarker(myPos, { radius: 8, color: '#fff', weight: 3, fillColor: '#1e88e5', fillOpacity: 1 }).addTo(mine).bindPopup('Você está aqui'); }).catch(() => {});
  }

  function nav() {
    const s = load(), n = document.getElementById('nav'), items = [el('a', { href: '#/' }, 'Cafeterias')];
    if (s.user) items.push(el('a', { href: '#/passaporte' }, 'Meu passaporte'), el('a', { href: '#/scanner', class: 'btn-sm' }, '📷 Check-in'),
      el('a', { href: '#/meus-dados' }, 'Meus dados'), el('a', { href: '#/', onclick: () => { save({ ...load(), user: null }); nav(); } }, 'Sair'));
    else items.push(el('a', { href: '#/como-funciona' }, 'Como funciona'), el('a', { href: '#/login', class: 'btn-sm' }, 'Entrar'));
    n.replaceChildren(...items); n.classList.remove('open');
  }

  /* ---------- telas ---------- */
  function viewHome() {
    const s = load(), vis = visitedSet(), list = el('section', { class: 'grid' }), mapBox = el('div', { class: 'map' });
    const search = el('input', { class: 'search', type: 'search', placeholder: 'Buscar cafeteria ou endereço…' });
    const draw = () => {
      const q = search.value.toLowerCase().trim();
      const rows = cafes.filter(c => !q || (c.name + ' ' + c.address + ' ' + (c.products || '')).toLowerCase().includes(q));
      list.replaceChildren(...rows.map(c => el('a', { class: 'card cafe-card' + (vis.has(c.slug) ? ' done' : ''), href: '#/cafe?slug=' + encodeURIComponent(c.slug) },
        avatar(c), el('div', { class: 'card-body' },
          el('h3', {}, c.name, vis.has(c.slug) ? el('span', { class: 'badge ok' }, '✓ visitada') : null),
          el('p', { class: 'muted small' }, 'Combo a confirmar'), el('p', { class: 'muted small' }, '📍 ', c.address || '')))));
    };
    search.addEventListener('input', draw);
    mount(el('section', { class: 'hero' },
        el('img', { src: 'img/logo.png', alt: 'Caxias in Caffè', class: 'hero-logo' }),
        el('p', { class: 'lead' }, 'Visite as ', el('b', {}, goal()), ' cafeterias participantes, consuma o combo e leia o QR Code no balcão. Complete o passaporte!'),
        el('div', { class: 'hero-actions' }, el('a', { class: 'btn', href: s.user ? '#/scanner' : '#/login' }, '📷 Fazer check-in'),
          el('a', { class: 'btn-sec', href: s.user ? '#/passaporte' : '#/como-funciona' }, s.user ? 'Meu passaporte (' + vis.size + '/' + goal() + ')' : 'Como funciona'))),
      el('h2', {}, 'Mapa das cafeterias'),
      cafes.some(c => c.lat !== null) ? null : alertBox('Localização das cafeterias em cadastro — os pins aparecerão quando as coordenadas forem informadas. O ponto azul mostra você.'),
      mapBox, el('div', { class: 'toolbar' }, search), list);
    draw(); buildMap(mapBox, cafes);
  }

  function viewCafe({ slug }) {
    const c = cafes.find(x => x.slug === slug); if (!c) return mount(alertBox('Cafeteria não encontrada.', 'err'));
    const waze = 'https://waze.com/ul?q=' + encodeURIComponent(c.name + ', ' + c.address + ', ' + c.city) + '&navigate=yes';
    const link = (u, t, cls) => safeUrl(u) ? el('a', { class: cls || 'btn-sec', href: safeUrl(u), target: '_blank', rel: 'noopener' }, t) : null;
    mount(el('section', { class: 'box' },
      el('p', {}, el('a', { href: '#/' }, '← Todas as cafeterias')),
      el('div', { class: 'cafe-head' }, avatar(c, 'lg'), el('div', {}, el('h1', {}, c.name), el('p', { class: 'muted' }, '📍 ', c.address, ' — ', c.city),
        visitedSet().has(c.slug) ? el('span', { class: 'badge ok' }, '✓ Você já fez check-in aqui') : null)),
      el('div', { class: 'combo-box' }, el('h2', {}, 'Combo da campanha'), el('p', { class: 'muted' }, 'Combo a confirmar pela cafeteria.'),
        c.products ? el('p', {}, el('b', {}, 'O que oferece: '), c.products) : null),
      el('h2', {}, 'Como chegar'),
      el('div', { class: 'actions-row' }, link(c.maps_url, '🗺️ Google Maps', 'btn'), link(waze, '🚗 Waze'), link(c.instagram_url, '📸 Instagram'))));
  }

  function viewLogin() {
    if (load().user) { location.hash = '#/passaporte'; return; }
    const name = el('input', { maxlength: 80, placeholder: 'Seu nome' }), city = el('input', { maxlength: 100, placeholder: 'Ex.: Caxias do Sul' });
    const uf = el('select', {}, UFS.map(u => el('option', { value: u }, u))); uf.value = 'RS';
    const consent = el('input', { type: 'checkbox' }), mkt = el('input', { type: 'checkbox' }), msg = alertBox('', 'err'); msg.hidden = true;
    mount(el('section', { class: 'box narrow' },
      el('h1', {}, 'Entrar (demonstração)'),
      alertBox('Na versão oficial o acesso é pelo botão "Entrar com Google". Aqui o cadastro é simulado e fica só neste aparelho.'),
      el('label', {}, 'Nome', name),
      el('div', { class: 'row2' }, el('label', {}, 'Cidade onde você mora', city), el('label', {}, 'UF', uf)),
      el('label', { class: 'check' }, consent, el('span', {}, 'Li e aceito os ', el('a', { href: '#/termos' }, 'Termos de Uso'), ' e a ', el('a', { href: '#/privacidade' }, 'Política de Privacidade'), ' (obrigatório).')),
      el('label', { class: 'check' }, mkt, el('span', {}, 'Quero receber novidades e eventos (opcional).')),
      el('button', { class: 'btn', onclick: () => {
        if (!name.value.trim() || !city.value.trim()) { msg.textContent = 'Informe nome e cidade.'; msg.hidden = false; return; }
        if (!consent.checked) { msg.textContent = 'Marque o aceite dos Termos e da Política de Privacidade.'; msg.hidden = false; return; }
        save({ ...load(), user: { name: name.value.trim(), city: city.value.trim(), state: uf.value, marketing: mkt.checked, consent_at: new Date().toISOString() } });
        nav(); const next = sessionStorage.getItem('after_login') || '#/passaporte'; sessionStorage.removeItem('after_login'); location.hash = next;
      } }, 'Entrar'), msg));
  }

  function viewPassport() {
    if (!requireLogin()) return;
    const s = load(), vis = visitedSet(), total = vis.size, pct = Math.round(total / Math.max(1, goal()) * 100);
    mount(el('section', { class: 'box' },
      el('h1', {}, 'Olá, ', s.user.name, '!'),
      total >= goal() ? alertBox('🏆 Parabéns! Você visitou todas as cafeterias (demonstração).', 'ok big') : null,
      el('div', { class: 'kpis' }, kpi(total + '/' + goal(), 'cafeterias visitadas'), kpi(goal() - total, 'faltam')),
      el('div', { class: 'progress' }, el('div', { style: 'width:' + pct + '%' })),
      el('a', { class: 'btn', href: '#/scanner' }, '📷 Ler QR Code'),
      el('h2', {}, 'Cafeterias visitadas'),
      s.visits.length ? el('ul', { class: 'list' }, [...s.visits].reverse().map(v => el('li', {}, '✅ ', (cafes.find(c => c.slug === v.slug) || { name: v.slug }).name, ' ',
        el('small', {}, fmtDate(v.at), v.acc ? ' · GPS ±' + v.acc + ' m' : '')))) : el('p', { class: 'muted' }, 'Nenhum check-in ainda.'),
      el('h2', {}, 'Ainda faltam'),
      el('ul', { class: 'list' }, cafes.filter(c => !vis.has(c.slug)).map(c => el('li', {}, '☕ ', el('a', { href: '#/cafe?slug=' + encodeURIComponent(c.slug) }, c.name))))));
  }

  function parseQr(text) {
    try {
      const u = new URL(text), base = new URL('index.html', location.href);
      if (u.origin !== location.origin || u.pathname.replace(/index\.html$/, '') !== base.pathname.replace(/index\.html$/, '')) return null;
      const [p, qs] = u.hash.replace(/^#/, '').split('?'); if (p !== '/checkin') return null;
      const q = Object.fromEntries(new URLSearchParams(qs)); return q.c && q.k ? q : null;
    } catch { return null; }
  }
  async function doCheckin(p, show) {
    const c = cafes.find(x => x.slug === p.c);
    if (!c || p.k !== 'demo') throw new Error('QR Code inválido para a demonstração.');
    const s = load();
    if (s.visits.some(v => v.slug === c.slug)) throw new Error('Você já fez check-in em ' + c.name + '.');
    show('Confirmando sua localização…', null);
    let acc = null; try { const g = await locate({ maximumAge: 0 }); acc = Math.round(g.accuracy); } catch { }
    s.visits.push({ slug: c.slug, at: new Date().toISOString(), acc }); save(s);
    return 'Check-in confirmado em ' + c.name + '! Você tem ' + s.visits.length + '/' + goal() + '.' + (acc ? ' (GPS ±' + acc + ' m)' : ' (localização não autorizada)');
  }

  function viewScanner() {
    if (!requireLogin('#/scanner')) return;
    const msg = alertBox(''); msg.hidden = true;
    const show = (t, ok) => { msg.textContent = t; msg.className = 'alert ' + (ok === true ? 'ok' : ok === false ? 'err' : ''); msg.hidden = false; };
    mount(el('section', { class: 'box narrow' }, el('h1', {}, 'Check-in'),
      el('ol', { class: 'steps' }, el('li', {}, 'Abra as "Placas QR de teste" em outro aparelho (ou imprima).'), el('li', {}, 'Aponte a câmera para o QR Code.'), el('li', {}, 'Permita a localização.')),
      el('div', { id: 'reader' }), msg, el('p', { class: 'small' }, el('a', { href: 'placas.html' }, 'Abrir placas QR de teste'))));
    if (!window.Html5Qrcode) return show('Leitor indisponível (sem internet).', false);
    scanner = new Html5Qrcode('reader'); let busy = false;
    const start = () => scanner && scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, async text => {
      if (busy) return; busy = true;
      const p = parseQr(text);
      if (!p) { show('Este QR Code não pertence a esta demonstração.', false); setTimeout(() => busy = false, 2000); return; }
      await scanner.stop().catch(() => {});
      try { show(await doCheckin(p, show), true); setTimeout(() => location.hash = '#/passaporte', 2500); }
      catch (e) { show(e.message, false); setTimeout(() => { busy = false; start(); }, 3000); }
    }).catch(() => show('Não foi possível acessar a câmera. Autorize o acesso nas configurações do navegador.', false));
    start();
  }

  function viewCheckin(p) {
    if (!requireLogin()) return;
    const c = cafes.find(x => x.slug === p.c), msg = alertBox(''); msg.hidden = true;
    const show = (t, ok) => { msg.textContent = t; msg.className = 'alert ' + (ok === true ? 'ok' : ok === false ? 'err' : ''); msg.hidden = false; };
    const btn = el('button', { class: 'btn', onclick: async () => { btn.disabled = true; try { show(await doCheckin(p, show), true); } catch (e) { show(e.message, false); btn.disabled = false; } } }, 'Confirmar check-in');
    mount(el('section', { class: 'box narrow center' }, c ? avatar(c, 'lg') : null, el('h1', {}, c ? c.name : 'QR inválido'),
      el('p', {}, 'Confirme após consumir o combo.'), c ? btn : null, msg, el('p', {}, el('a', { href: '#/passaporte' }, 'Ver meu passaporte'))));
  }

  function viewMyData() {
    if (!requireLogin()) return;
    const s = load();
    mount(el('section', { class: 'box narrow' }, el('h1', {}, 'Meus dados (LGPD)'),
      el('p', {}, el('b', {}, 'Nome: '), s.user.name, el('br'), el('b', {}, 'Cidade: '), s.user.city + '/' + s.user.state, el('br'),
        el('b', {}, 'Aceite: '), fmtDate(s.user.consent_at), el('br'), el('b', {}, 'Novidades: '), s.user.marketing ? 'sim' : 'não'),
      el('button', { class: 'btn-sec', onclick: () => {
        const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' })), download: 'meus-dados-demo.json' }); a.click();
      } }, '⬇️ Baixar meus dados (JSON)'),
      el('button', { class: 'btn-danger', onclick: () => { if (confirm('Apagar todos os dados desta demonstração neste aparelho?')) { localStorage.removeItem(KEY); nav(); location.hash = '#/'; } } }, 'Excluir meus dados')));
  }

  function viewHow() {
    mount(el('section', { class: 'box prose' }, el('h1', {}, 'Como funciona'), el('ol', { class: 'steps' },
      el('li', {}, 'Entre (na versão oficial, com a conta Google) e informe a cidade onde mora.'),
      el('li', {}, 'Escolha uma cafeteria no mapa ou na lista e veja o combo da campanha.'),
      el('li', {}, 'Use Google Maps ou Waze para chegar.'),
      el('li', {}, 'Consuma o combo e leia o QR Code da placa no balcão.'),
      el('li', {}, 'Permita a localização: na versão oficial o check-in só vale estando na cafeteria.'),
      el('li', {}, 'Complete o passaporte visitando todas as ' + goal() + ' cafeterias.')),
      el('a', { class: 'btn', href: '#/login' }, 'Começar')));
  }
  function viewPrivacy() {
    mount(el('section', { class: 'box prose' }, el('h1', {}, 'Privacidade (resumo)'),
      el('p', {}, 'Nesta DEMONSTRAÇÃO nada é enviado a servidores: nome, cidade e check-ins ficam apenas no armazenamento local do seu navegador e podem ser apagados em "Meus dados".'),
      el('p', {}, 'Na versão oficial, o controlador é o Sindilojas Caxias do Sul. São tratados nome, e-mail (Google), cidade/UF e check-ins (cafeteria, data e distância até o local — sem guardar sua localização), com consentimento e direitos do titular conforme a LGPD (art. 18).'),
      el('p', {}, 'Câmera: usada só para ler o QR; as imagens não saem do aparelho.')));
  }
  function viewTerms() {
    mount(el('section', { class: 'box prose' }, el('h1', {}, 'Termos (resumo)'), el('ol', {},
      el('li', {}, 'Participação gratuita e pessoal.'), el('li', {}, 'Check-in válido após consumir o combo, lendo o QR da cafeteria e estando no local.'),
      el('li', {}, 'Um check-in por cafeteria por participante.'), el('li', {}, 'A organização pode invalidar check-ins com indício de fraude.'),
      el('li', {}, 'Premiação conforme regulamento oficial.'))));
  }
  function viewHomolog() {
    const ok = (t) => el('li', {}, '☐ ', t);
    mount(el('section', { class: 'box prose' }, el('h1', {}, 'Roteiro rápido de homologação (celular)'),
      el('ol', {}, ok('Abrir o link no celular (Android e iPhone) e conferir logo, cores e leitura.'), ok('Buscar uma cafeteria e abrir o detalhe.'),
        ok('Tocar em Google Maps e Waze e conferir o endereço.'), ok('Entrar informando nome e cidade; tentar sem aceitar os termos (deve bloquear).'),
        ok('Abrir as Placas QR em outro aparelho e fazer check-in pelo botão Check-in.'), ok('Fazer check-in lendo um QR com a câmera nativa do celular.'),
        ok('Repetir o check-in na mesma cafeteria (deve recusar).'), ok('Conferir o passaporte (X/32) e a lista do que falta.'),
        ok('Instalar na tela inicial (Adicionar à tela inicial).'), ok('Baixar e excluir os dados em Meus dados.')),
      el('p', {}, 'Registre os resultados no arquivo documentacao/HOMOLOGACAO.md do projeto.')));
  }

  const routes = { '/': viewHome, '/cafe': viewCafe, '/login': viewLogin, '/passaporte': viewPassport, '/scanner': viewScanner, '/checkin': viewCheckin,
    '/meus-dados': viewMyData, '/como-funciona': viewHow, '/privacidade': viewPrivacy, '/termos': viewTerms, '/homologacao': viewHomolog };
  function router() { stopAll(); const { path, params } = route(); try { (routes[path] || viewHome)(params); } catch (e) { mount(alertBox(e.message, 'err')); } }

  document.getElementById('menu-btn').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
  try { cafes = await (await fetch('data/cafes.json', { cache: 'no-cache' })).json(); }
  catch { mount(alertBox('Não foi possível carregar as cafeterias.', 'err')); return; }
  cafes.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  nav(); window.addEventListener('hashchange', router); router();
})();
