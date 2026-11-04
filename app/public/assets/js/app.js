/* App do participante - Caxias in Caffè 2026 (SPA com rotas por hash) */
(async function () {
  const CAXIAS = [-29.1678, -51.1794];
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  let S, scanner = null, map = null, cafesCache = null, visited = new Set(), myPos = null;

  async function loadCafes() { if (!cafesCache) cafesCache = (await API.get('cafes')).cafes; return cafesCache; }
  async function loadVisited() {
    if (!S.user) { visited = new Set(); return null; }
    const p = await API.get('me/passport'); visited = new Set(p.visits.map(v => v.slug)); return p;
  }
  function stopAll() {
    if (scanner) { scanner.stop().catch(() => {}); scanner = null; }
    if (map) { map.remove(); map = null; }
  }
  function distKm(a, b) {
    const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLng = (b[1] - a[1]) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  const fmtDist = km => km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km';
  function locate(opts = {}) {
    return new Promise((ok, no) => {
      if (!navigator.geolocation) return no(new Error('Este aparelho não oferece localização.'));
      navigator.geolocation.getCurrentPosition(p => ok(p.coords), e => no(e), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000, ...opts });
    });
  }
  function requireLogin(after) {
    if (S.user) return true;
    sessionStorage.setItem('after_login', after || location.hash); location.hash = '#/login'; return false;
  }
  const kpi = (n, t) => el('div', { class: 'kpi' }, el('span', {}, n), t);

  function buildMap(node, cafes, { showUser = true } = {}) {
    if (!window.L) { node.replaceChildren(alertBox('Mapa indisponível (sem internet).', '')); return null; }
    map = L.map(node, { scrollWheelZoom: false }).setView(CAXIAS, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const pts = [];
    cafes.filter(c => c.lat !== null).forEach(c => {
      const done = visited.has(c.slug);
      const m = L.circleMarker([c.lat, c.lng], { radius: 10, weight: 3, color: '#fff', fillOpacity: 1, fillColor: done ? '#2e7d32' : '#8a4b24' }).addTo(map);
      m.bindPopup(el('div', { class: 'pop' }, el('b', {}, c.name), el('br'), c.combo_name ? el('span', {}, '☕ ' + c.combo_name) : null,
        done ? el('div', { class: 'ok-txt' }, '✓ Visitada') : null, el('a', { href: '#/cafe?slug=' + encodeURIComponent(c.slug) }, 'Ver detalhes')));
      pts.push([c.lat, c.lng]);
    });
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    const mine = map;
    if (showUser) locate().then(p => {
      if (map !== mine) return;
      myPos = [p.latitude, p.longitude];
      L.circleMarker(myPos, { radius: 8, color: '#fff', weight: 3, fillColor: '#1e88e5', fillOpacity: 1 }).addTo(mine).bindPopup('Você está aqui');
    }).catch(() => {});
    return map;
  }

  function nav() {
    const n = document.getElementById('nav'); const items = [el('a', { href: '#/' }, 'Cafeterias')];
    if (S.user) items.push(el('a', { href: '#/passaporte' }, 'Meu passaporte'), el('a', { href: '#/scanner', class: 'btn-sm' }, '📷 Check-in'),
      el('a', { href: '#/meus-dados' }, 'Meus dados'), el('a', { href: '#/', onclick: logout }, 'Sair'));
    else items.push(el('a', { href: '#/como-funciona' }, 'Como funciona'), el('a', { href: '#/login', class: 'btn-sm' }, 'Entrar com Google'));
    n.replaceChildren(...items); n.classList.remove('open');
  }
  async function logout(ev) { ev.preventDefault(); await API.post('auth/logout'); S = await API.init(); visited = new Set(); nav(); location.hash = '#/'; }

  async function viewHome() {
    const cafes = await loadCafes(); await loadVisited().catch(() => {});
    const list = el('section', { class: 'grid' }), mapBox = el('div', { class: 'map' });
    const search = el('input', { class: 'search', type: 'search', placeholder: 'Buscar cafeteria, combo ou endereço…' });
    const nearBtn = el('button', { class: 'btn-sec', onclick: async () => {
      nearBtn.disabled = true; nearBtn.textContent = 'Localizando…';
      try { const p = await locate(); myPos = [p.latitude, p.longitude]; draw(); nearBtn.textContent = '📍 Ordenado por proximidade'; }
      catch { nearBtn.textContent = '📍 Localização não autorizada'; }
      nearBtn.disabled = false;
    } }, '📍 Mais próximas de mim');
    function draw() {
      const q = search.value.toLowerCase().trim();
      let rows = cafes.filter(c => !q || [c.name, c.address, c.combo_name, c.combo_description].join(' ').toLowerCase().includes(q));
      rows = rows.map(c => ({ ...c, km: myPos && c.lat !== null ? distKm(myPos, [c.lat, c.lng]) : null }));
      if (myPos) rows.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
      list.replaceChildren(...rows.map(card));
      if (!rows.length) list.append(el('p', { class: 'muted' }, 'Nenhuma cafeteria encontrada.'));
    }
    search.addEventListener('input', draw);
    const c = S.campaign;
    mount(
      el('section', { class: 'hero' },
        el('img', { src: 'assets/img/logo.png', alt: 'Caxias in Caffè', class: 'hero-logo' }),
        el('p', { class: 'lead' }, 'Visite as ', el('b', {}, c.goal), ' cafeterias participantes, consuma o combo da campanha e leia o QR Code no balcão. Complete o passaporte e concorra à premiação!'),
        c.open ? null : alertBox(new Date() < new Date(c.start.replace(' ', 'T')) ? 'Lançamento oficial em ' + fmtDate(c.start, false) + '. Já dá para conhecer as cafeterias!' : 'A campanha está encerrada.', ''),
        el('div', { class: 'hero-actions' },
          el('a', { class: 'btn', href: S.user ? '#/scanner' : '#/login' }, '📷 Fazer check-in'),
          S.user ? el('a', { class: 'btn-sec', href: '#/passaporte' }, 'Meu passaporte (' + visited.size + '/' + c.goal + ')') : el('a', { class: 'btn-sec', href: '#/como-funciona' }, 'Como funciona'))),
      el('h2', {}, 'Mapa das cafeterias'),
      el('p', { class: 'small muted' }, el('span', { class: 'dot brown' }), ' a visitar  ', el('span', { class: 'dot green' }), ' visitada  ', el('span', { class: 'dot blue' }), ' você'),
      mapBox, el('div', { class: 'toolbar' }, search, nearBtn), list);
    draw(); buildMap(mapBox, cafes);
  }
  function card(c) {
    const done = visited.has(c.slug);
    return el('a', { class: 'card cafe-card' + (done ? ' done' : ''), href: '#/cafe?slug=' + encodeURIComponent(c.slug) },
      cafeAvatar(c),
      el('div', { class: 'card-body' },
        el('h3', {}, c.name, done ? el('span', { class: 'badge ok' }, '✓ visitada') : null),
        c.combo_name ? el('p', { class: 'combo' }, '☕ ', c.combo_name) : el('p', { class: 'muted small' }, 'Combo a confirmar'),
        el('p', { class: 'muted small' }, '📍 ', c.address || '', c.km != null ? ' · ' + fmtDist(c.km) : '')));
  }

  async function viewCafe({ slug }) {
    const { cafe: c } = await API.get('cafe', { slug }); await loadVisited().catch(() => {});
    const link = (u, t, cls) => safeUrl(u) ? el('a', { class: cls || 'btn-sec', href: safeUrl(u), target: '_blank', rel: 'noopener' }, t) : null;
    const mapBox = el('div', { class: 'map small' });
    mount(el('section', { class: 'box' },
      el('p', {}, el('a', { href: '#/' }, '← Todas as cafeterias')),
      el('div', { class: 'cafe-head' }, cafeAvatar(c, 'lg'), el('div', {}, el('h1', {}, c.name), el('p', { class: 'muted' }, '📍 ', c.address || '', ' — ', c.city || ''),
        visited.has(c.slug) ? el('span', { class: 'badge ok' }, '✓ Você já fez check-in aqui') : null)),
      el('div', { class: 'combo-box' },
        el('h2', {}, 'Combo da campanha'),
        c.combo_name ? el('p', { class: 'combo big' }, '☕ ', c.combo_name) : el('p', { class: 'muted' }, 'Combo a confirmar pela cafeteria.'),
        c.combo_description ? el('p', {}, c.combo_description) : null,
        c.combo_photo_url ? el('img', { class: 'combo-photo', src: safeUrl(c.combo_photo_url), alt: 'Foto do combo ' + (c.combo_name || ''), loading: 'lazy' }) : null),
      el('h2', {}, 'Como chegar'),
      el('div', { class: 'actions-row' }, link(c.maps_url, '🗺️ Google Maps', 'btn'), link(c.waze_url, '🚗 Waze'), link(c.whatsapp_url, '💬 WhatsApp'), link(c.instagram_url, '📸 Instagram')),
      c.lat !== null ? mapBox : null,
      el('p', {}, el('a', { class: 'btn', href: S.user ? '#/scanner' : '#/login' }, '📷 Fazer check-in nesta cafeteria'))));
    if (c.lat !== null && buildMap(mapBox, [c])) map.setView([c.lat, c.lng], 16);
  }

  function viewLogin() {
    if (S.user) { location.hash = '#/passaporte'; return; }
    const city = el('input', { maxlength: 100, autocomplete: 'address-level2', placeholder: 'Ex.: Caxias do Sul' });
    const uf = el('select', { autocomplete: 'address-level1' }, el('option', { value: '' }, 'UF'), UFS.map(u => el('option', { value: u }, u)));
    uf.value = 'RS';
    const consent = el('input', { type: 'checkbox' }), mkt = el('input', { type: 'checkbox' });
    const msg = alertBox('', 'err'); msg.hidden = true; const btn = el('div', { id: 'gbtn' });
    const show = t => { msg.textContent = t; msg.hidden = false; };
    mount(el('section', { class: 'box narrow' },
      el('h1', {}, 'Entrar'),
      el('p', {}, 'Use sua conta Google. Guardamos apenas ', el('b', {}, 'nome, e-mail e cidade de residência'), ', para registrar seus check-ins e conhecer a origem dos visitantes.'),
      el('div', { class: 'row2' }, el('label', {}, 'Cidade onde você mora', city), el('label', {}, 'UF', uf)),
      el('p', { class: 'small muted' }, 'Obrigatório no primeiro acesso.'),
      el('label', { class: 'check' }, consent, el('span', {}, 'Li e aceito os ', el('a', { href: '#/termos' }, 'Termos de Uso'), ' e a ', el('a', { href: '#/privacidade' }, 'Política de Privacidade'), ' (obrigatório).')),
      el('label', { class: 'check' }, mkt, el('span', {}, 'Quero receber novidades e eventos do Sindilojas, da Secretaria de Turismo e das cafeterias (opcional).')),
      btn, msg,
      S.google_client_id.startsWith('SEU_') ? alertBox('Ambiente de teste: configure google_client_id no config.php para o login Google funcionar.', '') : null));
    let tries = 0;
    const start = () => {
      if (!window.google?.accounts?.id) { if (++tries < 30) setTimeout(start, 300); else show('Não foi possível carregar o login Google.'); return; }
      google.accounts.id.initialize({ client_id: S.google_client_id, callback: async (resp) => {
        if (!consent.checked) return show('Marque o aceite dos Termos e da Política de Privacidade.');
        try {
          await API.post('auth/google', { credential: resp.credential, consent: true, marketing: mkt.checked, city: city.value.trim(), state: uf.value });
          S = await API.init(); nav();
          const next = sessionStorage.getItem('after_login') || '#/passaporte'; sessionStorage.removeItem('after_login');
          location.hash = next;
        } catch (e) { show(e.message); }
      } });
      google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR' });
    };
    start();
  }

  async function viewPassport() {
    if (!requireLogin()) return;
    const [p, cafes] = await Promise.all([loadVisited(), loadCafes()]);
    const pct = Math.min(100, Math.round(p.total / Math.max(1, p.goal) * 100));
    const mapBox = el('div', { class: 'map' });
    mount(el('section', { class: 'box' },
      el('h1', {}, 'Olá, ', S.user.name, '!'),
      p.completed ? el('div', { class: 'alert ok big' }, '🏆 Parabéns! Você visitou todas as cafeterias',
        p.completion_position ? ' — você foi o(a) ' + p.completion_position + 'º a completar!' : '!', ' Aguarde o contato da organização sobre a premiação.') : null,
      el('div', { class: 'kpis' }, kpi(p.total + '/' + p.goal, 'cafeterias visitadas'), kpi(Math.max(0, p.goal - p.total), 'faltam para completar')),
      el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('div', { style: 'width:' + pct + '%' })),
      el('a', { class: 'btn', href: '#/scanner' }, '📷 Ler QR Code'),
      el('h2', {}, 'Seu percurso'), mapBox,
      el('h2', {}, 'Cafeterias visitadas'),
      p.visits.length ? el('ul', { class: 'list' }, p.visits.map(v => el('li', {}, '✅ ', el('a', { href: '#/cafe?slug=' + encodeURIComponent(v.slug) }, v.name), ' ', el('small', {}, fmtDate(v.created_at)))))
                      : el('p', { class: 'muted' }, 'Nenhum check-in ainda. Escolha uma cafeteria no mapa e bom café!'),
      el('h2', {}, 'Ainda faltam'),
      el('ul', { class: 'list' }, cafes.filter(c => !visited.has(c.slug)).map(c => el('li', {}, '☕ ', el('a', { href: '#/cafe?slug=' + encodeURIComponent(c.slug) }, c.name), c.combo_name ? el('small', {}, ' — ' + c.combo_name) : null)))));
    buildMap(mapBox, cafes);
  }

  async function sendCheckin(params, show) {
    let pos = null;
    if (S.geofence.mode !== 'off') {
      show('Confirmando sua localização…', null);
      try { const c = await locate({ maximumAge: 0 }); pos = { lat: c.latitude, lng: c.longitude, acc: Math.round(c.accuracy) }; } catch { }
    }
    const r = await API.post('checkin', { ...params, ...(pos || {}) });
    cafesCache = null; visited.add(params.c);
    return r;
  }

  function viewScanner() {
    if (!requireLogin('#/scanner')) return;
    const msg = alertBox('', ''); msg.hidden = true;
    mount(el('section', { class: 'box narrow' },
      el('h1', {}, 'Check-in'),
      el('ol', { class: 'steps' }, el('li', {}, 'Consuma o combo da campanha.'), el('li', {}, 'Aponte a câmera para o QR Code da placa no balcão.'), el('li', {}, 'Permita a localização para confirmarmos que você está na cafeteria.')),
      el('div', { id: 'reader' }), msg,
      el('p', { class: 'small muted' }, 'A câmera é processada só no seu aparelho. Da localização, guardamos apenas a distância até a cafeteria.')));
    const show = (t, ok) => { msg.textContent = t; msg.className = 'alert ' + (ok === true ? 'ok' : ok === false ? 'err' : ''); msg.hidden = false; };
    if (!window.Html5Qrcode) return show('Leitor de QR indisponível (sem internet). Use a câmera do celular.', false);
    scanner = new Html5Qrcode('reader'); let busy = false;
    const start = () => scanner && scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan)
      .catch(() => show('Não foi possível acessar a câmera. Autorize o acesso no navegador (requer HTTPS ou localhost).', false));
    async function onScan(text) {
      if (busy) return; busy = true;
      const p = parseQr(text);
      if (!p) { show('Este QR Code não pertence à campanha Caxias in Caffè.', false); setTimeout(() => busy = false, 2000); return; }
      await scanner.stop().catch(() => {});
      try { const r = await sendCheckin(p, show); show(r.message + ' Você tem ' + r.total + '/' + r.goal + '.', true); setTimeout(() => location.hash = '#/passaporte', 2500); }
      catch (e) { show(e.message, false); setTimeout(() => { busy = false; start(); }, 3500); }
    }
    start();
  }
  function parseQr(text) {
    try {
      const u = new URL(text); if (u.origin !== location.origin) return null;
      const [path, qs] = u.hash.replace(/^#/, '').split('?'); if (path !== '/checkin') return null;
      const q = Object.fromEntries(new URLSearchParams(qs));
      return q.c && (q.k || (q.t && q.s)) ? { c: q.c, k: q.k, t: q.t, s: q.s } : null;
    } catch { return null; }
  }

  async function viewCheckin(params) {
    if (!requireLogin()) return;
    let cafe = null; try { cafe = (await API.get('cafe', { slug: params.c })).cafe; } catch {}
    const msg = alertBox('', ''); msg.hidden = true;
    const show = (t, ok) => { msg.textContent = t; msg.className = 'alert ' + (ok === true ? 'ok' : ok === false ? 'err' : ''); msg.hidden = false; };
    const btn = el('button', { class: 'btn', onclick: async () => {
      btn.disabled = true;
      try { const r = await sendCheckin({ c: params.c, k: params.k, t: params.t, s: params.s }, show); show(r.message + ' Você tem ' + r.total + '/' + r.goal + '.', true); }
      catch (e) { show(e.message, false); btn.disabled = false; }
    } }, 'Confirmar check-in');
    mount(el('section', { class: 'box narrow center' },
      cafe ? cafeAvatar(cafe, 'lg') : null, el('h1', {}, cafe ? cafe.name : 'Confirmar check-in'),
      cafe?.combo_name ? el('p', { class: 'combo' }, '☕ ', cafe.combo_name) : null,
      el('p', {}, 'Confirme após consumir o combo. Vamos pedir sua localização para validar.'), btn, msg,
      el('p', {}, el('a', { href: '#/passaporte' }, 'Ver meu passaporte'))));
  }

  async function viewMyData() {
    if (!requireLogin()) return;
    const { data: u } = await API.get('me/data');
    const city = el('input', { value: u.city || '', maxlength: 100 });
    const uf = el('select', {}, UFS.map(x => el('option', { value: x }, x))); uf.value = u.state || 'RS';
    const mkt = el('input', { type: 'checkbox' }); mkt.checked = !!Number(u.consent_marketing);
    const msg = alertBox('', 'ok'); msg.hidden = true;
    mount(el('section', { class: 'box narrow' },
      el('h1', {}, 'Meus dados (LGPD)'),
      el('p', {}, el('b', {}, 'Nome: '), u.name, el('br'), el('b', {}, 'E-mail: '), u.email, el('br'),
        el('b', {}, 'Aceite dos termos: '), fmtDate(u.consent_terms_at), ' (versão ', u.consent_version, ')'),
      el('div', { class: 'row2' }, el('label', {}, 'Cidade de residência', city), el('label', {}, 'UF', uf)),
      el('label', { class: 'check' }, mkt, el('span', {}, 'Receber novidades e eventos (opcional)')),
      el('button', { class: 'btn-sec', onclick: async () => {
        try { await API.post('me/profile', { city: city.value, state: uf.value, marketing: mkt.checked }); msg.className = 'alert ok'; msg.textContent = 'Dados atualizados.'; }
        catch (e) { msg.className = 'alert err'; msg.textContent = e.message; } msg.hidden = false;
      } }, 'Salvar'),
      el('a', { class: 'btn-sec', href: 'api.php?action=me/export' }, '⬇️ Baixar meus dados (JSON)'),
      el('button', { class: 'btn-danger', onclick: async () => {
        if (!confirm('Excluir definitivamente sua conta e todos os check-ins?')) return;
        await API.post('me/delete'); S = await API.init(); nav(); mount(alertBox('Sua conta e seus dados foram excluídos.', 'ok'));
      } }, 'Excluir minha conta'),
      msg, el('p', { class: 'small' }, 'Dúvidas sobre seus dados: ', S.dpo_email)));
  }

  function viewHow() {
    mount(el('section', { class: 'box prose' },
      el('h1', {}, 'Como funciona'),
      el('ol', { class: 'steps' },
        el('li', {}, 'Entre com sua conta Google e informe a cidade onde mora.'),
        el('li', {}, 'Escolha uma cafeteria no mapa ou na lista e veja o combo da campanha.'),
        el('li', {}, 'Toque em Google Maps ou Waze para ir até lá.'),
        el('li', {}, 'Consuma o combo e leia o QR Code da placa no balcão (pelo app ou pela câmera do celular).'),
        el('li', {}, 'Permita a localização: o check-in só vale estando na cafeteria.'),
        el('li', {}, 'Acompanhe seu passaporte. Quem visitar todas as ' + S.campaign.goal + ' cafeterias concorre à premiação conforme o regulamento.')),
      el('a', { class: 'btn', href: S.user ? '#/' : '#/login' }, S.user ? 'Ver cafeterias' : 'Começar')));
  }
  function viewPrivacy() {
    const sec = (t, ...c) => [el('h2', {}, t), ...c];
    mount(el('section', { class: 'box prose' },
      el('h1', {}, 'Política de Privacidade'), el('p', { class: 'muted' }, 'Versão ' + S.terms_version + ' · Lei nº 13.709/2018 (LGPD)'),
      ...sec('1. Controlador', el('p', {}, 'Sindilojas Caxias do Sul, organizador da campanha Caxias in Caffè 2026, em parceria com a Secretaria Municipal de Turismo. Encarregado (DPO): ' + S.dpo_email + '.')),
      ...sec('2. Dados coletados', el('ul', {},
        el('li', {}, 'Da conta Google: nome, e-mail e identificador único. Não acessamos contatos, arquivos ou senha.'),
        el('li', {}, 'Cidade e UF de residência, informadas por você.'),
        el('li', {}, 'Check-ins: cafeteria, data, hora e a distância aproximada até a cafeteria no momento do check-in.'),
        el('li', {}, 'Endereço IP pseudonimizado (hash) para segurança.'))),
      ...sec('3. Localização', el('p', {}, 'A localização do aparelho é usada para mostrar sua posição no mapa e para confirmar que você está na cafeteria no momento do check-in. Não armazenamos suas coordenadas nem seu trajeto — apenas a distância calculada até a cafeteria.')),
      ...sec('4. Finalidades e bases legais', el('ul', {},
        el('li', {}, 'Registrar check-ins e validar a premiação — consentimento (art. 7º, I) e execução dos termos (art. 7º, V).'),
        el('li', {}, 'Estatísticas agregadas de origem dos visitantes para o turismo — legítimo interesse (art. 7º, IX).'),
        el('li', {}, 'Prevenção a fraudes — legítimo interesse (art. 7º, IX).'),
        el('li', {}, 'Novidades e eventos — somente com consentimento opcional, revogável a qualquer momento.'))),
      ...sec('5. Câmera', el('p', {}, 'Usada apenas para ler o QR Code; as imagens são processadas no aparelho e não são armazenadas nem enviadas.')),
      ...sec('6. Compartilhamento', el('p', {}, 'Dados não são vendidos. As cafeterias veem apenas quantidades de check-ins. A Secretaria de Turismo recebe apenas estatísticas agregadas. Operadores: hospedagem, Google (autenticação) e OpenStreetMap (mapa).')),
      ...sec('7. Retenção', el('p', {}, 'Durante a campanha e até ' + S.retention_days + ' dias após o término, salvo obrigação legal.')),
      ...sec('8. Seus direitos (art. 18)', el('p', {}, 'Acesso, correção, portabilidade, eliminação e revogação do consentimento em ', el('a', { href: '#/meus-dados' }, 'Meus dados'), ' ou pelo e-mail do Encarregado.')),
      ...sec('9. Segurança e cookies', el('p', {}, 'HTTPS, senhas com hash, proteção contra CSRF/XSS/SQL Injection, controle de acesso e auditoria. Usamos apenas o cookie de sessão necessário ao funcionamento.'))));
  }
  function viewTerms() {
    mount(el('section', { class: 'box prose' }, el('h1', {}, 'Termos de Uso'), el('ol', {},
      el('li', {}, 'Participação gratuita e pessoal; use sua própria conta Google.'),
      el('li', {}, 'O check-in só é válido após o consumo do combo da campanha, lendo o QR Code da cafeteria e estando no local.'),
      el('li', {}, 'É permitido um check-in por cafeteria por participante.'),
      el('li', {}, 'A organização pode invalidar check-ins com indícios de fraude.'),
      el('li', {}, 'Completa o passaporte quem visitar todas as ' + S.campaign.goal + ' cafeterias participantes. A premiação, quantidades e prazos seguem o regulamento oficial.'),
      el('li', {}, 'Campanha válida de ' + fmtDate(S.campaign.start, false) + ' a ' + fmtDate(S.campaign.end, false) + '.'))));
  }

  const routes = { '/': viewHome, '/cafe': viewCafe, '/login': viewLogin, '/passaporte': viewPassport, '/scanner': viewScanner,
    '/checkin': viewCheckin, '/meus-dados': viewMyData, '/como-funciona': viewHow, '/privacidade': viewPrivacy, '/termos': viewTerms };
  async function router() {
    stopAll();
    const { path, params } = hashRoute();
    try { await (routes[path] || viewHome)(params); }
    catch (e) {
      if (e.status === 401) { S.user = null; nav(); requireLogin(); return; }
      mount(alertBox(e.message, 'err'), el('p', {}, el('a', { href: '#/' }, 'Voltar ao início')));
    }
  }
  try { S = await API.init(); } catch (e) { mount(alertBox('Não foi possível conectar: ' + e.message, 'err')); return; }
  nav(); window.addEventListener('hashchange', router); router();
})();
