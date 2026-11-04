/* Painel da equipe - Caxias in Caffè 2026: login, senha, cafeteria e administração */
(async function () {
  let S, qrTimer = null, flash = null;
  const kpi = (n, t, cls) => el('div', { class: 'kpi ' + (cls || '') }, el('span', {}, n), t);
  const field = (label, input, hint) => el('label', {}, label, input, hint ? el('small', { class: 'muted' }, hint) : null);
  function table(head, rows) {
    return el('div', { class: 'scroll' }, el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, head.map(h => el('th', {}, h)))),
      el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => el('td', {}, c)))))));
  }
  function qrNode(url, size) {
    const box = el('div', { class: 'qr' });
    if (window.QRCode) new QRCode(box, { text: url, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    else box.append(alertBox('Gerador de QR indisponível (sem internet).', 'err'));
    return box;
  }
  function plaque(c, url) {
    return el('div', { class: 'plaque' },
      el('img', { src: 'assets/img/logo.png', alt: 'Caxias in Caffè', class: 'plaque-logo' }),
      el('p', { class: 'plaque-title' }, 'Faça seu check-in aqui!'),
      qrNode(url, 220),
      el('p', { class: 'plaque-cafe' }, c.name),
      el('p', { class: 'plaque-help' }, 'Consumiu o combo? Aponte a câmera do celular para o QR Code.'));
  }
  function nav() {
    const n = document.getElementById('nav'); const st = S.staff; const items = [];
    if (st && !st.must_change) {
      if (st.role === 'admin') items.push(el('a', { href: '#/' }, 'Painel'), el('a', { href: '#/ranking' }, 'Ranking'), el('a', { href: '#/clientes' }, 'Participantes'),
        el('a', { href: '#/cafeterias' }, 'Cafeterias'), el('a', { href: '#/placas' }, 'Placas QR'), el('a', { href: '#/auditoria' }, 'Auditoria'));
      else items.push(el('a', { href: '#/' }, 'Minha cafeteria'));
    }
    if (st) items.push(el('a', { href: '#/senha' }, 'Senha'), el('a', { href: '#/', onclick: logout }, 'Sair'));
    n.replaceChildren(...items); n.classList.remove('open');
  }
  async function logout(ev) { ev.preventDefault(); await API.post('auth/logout'); S = await API.init(); nav(); location.hash = '#/'; router(); }

  function viewLogin() {
    const u = el('input', { required: true, maxlength: 60, autocomplete: 'username' });
    const p = el('input', { type: 'password', required: true, autocomplete: 'current-password' });
    const msg = alertBox('', 'err'); msg.hidden = true;
    mount(el('section', { class: 'box narrow' }, el('h1', {}, 'Acesso Cafeterias / Administração'), msg,
      el('form', { onsubmit: async (ev) => {
        ev.preventDefault();
        try { await API.post('staff/login', { username: u.value.trim(), password: p.value }); S = await API.init(); nav(); location.hash = '#/'; router(); }
        catch (e) { msg.textContent = e.message; msg.hidden = false; }
      } }, field('Usuário', u), field('Senha', p), el('button', { class: 'btn' }, 'Entrar'))));
  }
  function viewPassword() {
    const cur = el('input', { type: 'password', required: true, autocomplete: 'current-password' });
    const nw = el('input', { type: 'password', required: true, minlength: 10, autocomplete: 'new-password' });
    const cf = el('input', { type: 'password', required: true, minlength: 10, autocomplete: 'new-password' });
    const msg = alertBox('', 'err'); msg.hidden = true;
    mount(el('section', { class: 'box narrow' }, el('h1', {}, 'Alterar senha'),
      S.staff.must_change ? alertBox('Por segurança, defina uma nova senha no primeiro acesso.', '') : null, msg,
      el('form', { onsubmit: async (ev) => {
        ev.preventDefault();
        try { await API.post('staff/password', { current: cur.value, new: nw.value, confirm: cf.value }); S = await API.init(); nav(); location.hash = '#/'; router(); }
        catch (e) { msg.textContent = e.message; msg.hidden = false; }
      } }, field('Senha atual', cur), field('Nova senha', nw), field('Confirmar nova senha', cf),
        el('p', { class: 'small muted' }, 'Mínimo 10 caracteres com maiúscula, minúscula, número e símbolo.'), el('button', { class: 'btn' }, 'Salvar'))));
  }

  async function viewCafe() {
    const d = await API.get('cafe/panel'); const c = d.cafe;
    const dynBox = el('div', { class: 'center' }), ttl = el('span', {}, '--');
    const dynBtn = el('button', { class: 'btn-sec no-print', onclick: () => startDynamic() }, '📱 Exibir QR dinâmico na tela (opcional)');
    mount(el('section', { class: 'box' },
      el('div', { class: 'cafe-head' }, cafeAvatar(c, 'lg'), el('div', {}, el('h1', {}, c.name), el('p', { class: 'muted' }, c.address || ''))),
      d.active ? null : alertBox('Sua cafeteria está fora da campanha no momento. Fale com a organização.', 'err'),
      c.combo_name ? el('p', { class: 'combo big' }, '☕ Combo: ', c.combo_name) : alertBox('Combo ainda não cadastrado. Envie nome, descrição, foto e logo para a organização.', ''),
      el('div', { class: 'kpis' }, kpi(d.stats.hoje, 'check-ins hoje'), kpi(d.stats.total, 'check-ins no total')),
      el('h2', {}, 'Placa para o balcão'),
      el('p', { class: 'no-print' }, 'Imprima e deixe no balcão. O cliente lê com a câmera após consumir o combo; o sistema confere se ele está na cafeteria.'),
      plaque(c, d.plaque_url),
      el('p', { class: 'no-print' }, el('button', { class: 'btn', onclick: () => window.print() }, '🖨️ Imprimir placa')),
      el('div', { class: 'no-print' }, dynBtn, dynBox)));
    function startDynamic() {
      if (!window.QRCode) return;
      dynBtn.hidden = true; const box = el('div', { class: 'qr' });
      dynBox.replaceChildren(box, el('p', { class: 'small muted' }, 'Renova a cada minuto · atualiza em ', ttl, 's'));
      const qr = new QRCode(box, { width: 260, height: 260, correctLevel: QRCode.CorrectLevel.M }); let left = 0;
      const refresh = async () => { try { const j = await API.get('cafe/qr'); qr.clear(); qr.makeCode(j.url); left = j.expires_in; } catch { location.reload(); } };
      qrTimer = setInterval(() => { left--; ttl.textContent = Math.max(left, 0); if (left <= 0) refresh(); }, 1000); refresh();
    }
  }

  async function viewDashboard() {
    const d = await API.get('admin/stats');
    const max = Math.max(1, ...d.por_cafeteria.map(r => Number(r.total_checkins)));
    mount(el('section', { class: 'box' },
      el('h1', {}, 'Painel administrativo'),
      el('div', { class: 'kpis' }, kpi(d.kpi.clientes, 'participantes'), kpi(d.kpi.checkins, 'check-ins válidos'),
        kpi(d.kpi.concluiram, 'completaram as ' + d.goal), kpi(d.kpi.cafeterias, 'cafeterias ativas'),
        kpi(d.kpi.cadastros_pendentes, 'cadastros incompletos', d.kpi.cadastros_pendentes ? 'warn' : '')),
      d.kpi.cadastros_pendentes ? alertBox('Há cafeterias sem combo, logo ou localização no mapa. Complete em Cafeterias.', '') : null,
      el('div', { class: 'actions-row' }, el('a', { class: 'btn-sec', href: 'api.php?action=admin/export' }, '⬇️ Exportar participantes (CSV)'), el('a', { class: 'btn-sec', href: '#/ranking' }, '🏆 Ranking de conclusão')),
      el('h2', {}, 'Origem dos visitantes (cidade de residência)'),
      d.por_cidade.length ? table(['Cidade', 'UF', 'Participantes', 'Check-ins'], d.por_cidade.map(r => [r.cidade, r.uf, r.clientes, r.checkins])) : el('p', { class: 'muted' }, 'Sem participantes ainda.'),
      el('h2', {}, 'Check-ins por cafeteria'),
      el('div', { class: 'bars' }, d.por_cafeteria.map(r => el('div', { class: 'bar' },
        el('span', { class: 'lbl' }, r.name), el('span', { class: 'track' }, el('i', { style: 'width:' + Math.round(r.total_checkins / max * 100) + '%' })), el('b', {}, r.total_checkins)))),
      el('h2', {}, 'Check-ins por dia'),
      d.por_dia.length ? table(['Dia', 'Check-ins'], d.por_dia.map(r => [fmtDate(r.dia, false), r.total_checkins])) : el('p', { class: 'muted' }, 'Sem check-ins ainda.')));
  }
  async function viewRanking() {
    const d = await API.get('admin/ranking');
    mount(el('section', { class: 'box' },
      el('h1', {}, '🏆 Ordem de conclusão'),
      el('p', {}, 'Participantes que visitaram todas as ', el('b', {}, d.goal), ' cafeterias ativas, na ordem em que completaram.'),
      d.ranking.length ? table(['#', 'Nome', 'E-mail', 'Cidade/UF', 'Concluiu em', ''], d.ranking.map(r => [el('b', {}, r.posicao + 'º'), r.name, r.email,
        r.city + '/' + r.state, fmtDate(r.concluido_em), el('a', { href: '#/cliente?id=' + r.user_id }, 'Conferir')]))
        : el('p', { class: 'muted' }, 'Ninguém completou ainda.')));
  }
  async function viewUsers(params) {
    const q = el('input', { placeholder: 'Nome, e-mail ou cidade', value: params.q || '' });
    const d = await API.get('admin/users', { q: params.q || '' });
    mount(el('section', { class: 'box' },
      el('h1', {}, 'Participantes (', d.users.length, ')'),
      el('form', { class: 'inline', onsubmit: (ev) => { ev.preventDefault(); location.hash = '#/clientes?q=' + encodeURIComponent(q.value); } }, q, el('button', { class: 'btn-sec' }, 'Buscar')),
      table(['Nome', 'E-mail', 'Cidade/UF', 'Check-ins', 'Completo', 'Último', ''], d.users.map(u => [u.name, u.email, u.city + '/' + u.state, el('b', {}, u.total_checkins + '/' + d.goal),
        d.goal > 0 && Number(u.total_checkins) >= d.goal ? '🏆' : '—', fmtDate(u.ultimo_checkin), el('a', { href: '#/cliente?id=' + u.id }, 'Detalhes')]))));
  }
  async function viewUser(params) {
    const d = await API.get('admin/user', { id: params.id });
    mount(el('section', { class: 'box' },
      el('p', {}, el('a', { href: '#/clientes' }, '← Participantes')),
      el('h1', {}, d.user.name), el('p', {}, d.user.email, ' · ', d.user.city, '/', d.user.state, ' · cadastro ', fmtDate(d.user.created_at, false)),
      table(['Cafeteria', 'Data', 'Via', 'Distância', 'Status', ''], d.checkins.map(k => {
        const b = el('button', { class: 'btn-sm', onclick: async () => { await API.post('admin/checkin/toggle', { id: k.id }); router(); } }, k.status === 'valid' ? 'Revogar' : 'Restaurar');
        return [k.name, fmtDate(k.created_at), k.method, k.distance_m !== null ? k.distance_m + ' m' : '—', k.status === 'valid' ? '✅ válido' : '⛔ revogado', b];
      }))));
  }
  async function viewCafes() {
    const d = await API.get('admin/cafes');
    const msg = alertBox('', 'ok'); msg.hidden = true;
    const say = (t, err) => { msg.textContent = t; msg.className = 'alert ' + (err ? 'err' : 'ok'); msg.hidden = false; window.scrollTo(0, 0); };
    const nName = el('input', { placeholder: 'Nome', required: true }), nAddr = el('input', { placeholder: 'Endereço' }), nPhone = el('input', { placeholder: 'Telefone' });
    const chk = (ok) => ok ? '✅' : '⚠️';
    mount(el('section', { class: 'box' },
      el('h1', {}, 'Cafeterias (', d.cafes.length, ')'), msg,
      el('p', { class: 'small muted' }, 'Status do cadastro: combo · logo · foto do combo · localização no mapa.'),
      el('details', {}, el('summary', {}, '➕ Nova cafeteria'),
        el('form', { class: 'inline', onsubmit: async (ev) => {
          ev.preventDefault();
          try { const r = await API.post('admin/cafe/create', { name: nName.value, address: nAddr.value, phone: nPhone.value });
                flash = 'Cafeteria criada. Login: ' + r.username + ' — Senha temporária: ' + r.temp_password + ' (exibida só agora).'; await viewCafes(); }
          catch (e) { say(e.message, true); }
        } }, nName, nAddr, nPhone, el('button', { class: 'btn-sec' }, 'Criar'))),
      table(['', 'Cafeteria', 'Combo', 'Logo', 'Foto', 'Mapa', 'Check-ins', 'Situação', ''], d.cafes.map(c => [
        cafeAvatar(c, 'sm'), el('div', {}, el('b', {}, c.name), el('br'), el('small', {}, c.username || 'sem login')),
        chk(c.combo_name), chk(c.logo_file), chk(c.combo_photo_file), chk(c.lat !== null), c.total_checkins,
        Number(c.active) ? el('span', { class: 'badge ok' }, 'na campanha') : el('span', { class: 'badge err' }, 'fora'),
        el('a', { class: 'btn-sm', href: '#/cafeteria?id=' + c.id }, 'Editar')]))));
    if (flash) { say(flash); flash = null; }
  }
  async function viewCafeEdit(params) {
    const d = await API.get('admin/cafes'); const c = d.cafes.find(x => String(x.id) === String(params.id));
    if (!c) return mount(alertBox('Cafeteria não encontrada.', 'err'));
    const msg = alertBox('', 'ok'); msg.hidden = true;
    const say = (t, err) => { msg.textContent = t; msg.className = 'alert ' + (err ? 'err' : 'ok'); msg.hidden = false; window.scrollTo(0, 0); };
    const f = {
      name: el('input', { value: c.name, maxlength: 160, required: true }), address: el('input', { value: c.address || '', maxlength: 400 }),
      combo_name: el('input', { value: c.combo_name || '', maxlength: 160, placeholder: 'Ex.: Pingado com quindim' }),
      combo_description: el('textarea', { maxlength: 600, rows: 3, placeholder: 'Explique o combo em linguagem simples' }, c.combo_description || ''),
      maps_link: el('input', { placeholder: 'Cole aqui o link do Google Maps (opcional)' }),
      lat: el('input', { value: c.lat ?? '', inputmode: 'decimal', placeholder: '-29.16…' }), lng: el('input', { value: c.lng ?? '', inputmode: 'decimal', placeholder: '-51.17…' }),
    };
    const act = (label, fn, confirmText, cls) => el('button', { type: 'button', class: cls || 'btn-sm', onclick: async () => {
      if (confirmText && !confirm(confirmText)) return;
      try { const r = await fn(); flash = r || null; await viewCafeEdit(params); } catch (e) { say(e.message, true); }
    } }, label);
    function imgBlock(kind, label, url) {
      const input = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
      const prev = url ? el('img', { class: kind === 'logo' ? 'avatar lg' : 'combo-photo', src: safeUrl(url), alt: label }) : el('p', { class: 'muted' }, 'Sem imagem — será exibido apenas o nome.');
      return el('div', { class: 'img-block' }, el('h3', {}, label), prev,
        el('div', { class: 'inline' }, input,
          act('Enviar', async () => { if (!input.files[0]) throw new Error('Escolha um arquivo.'); const fd = new FormData(); fd.append('id', c.id); fd.append('kind', kind); fd.append('file', input.files[0]);
            await API.upload('admin/cafe/upload', fd); return 'Imagem enviada.'; }),
          url ? act('Remover', async () => { await API.post('admin/cafe/image-delete', { id: c.id, kind }); return 'Imagem removida.'; }, 'Remover imagem?') : null),
        el('small', { class: 'muted' }, 'JPG, PNG ou WEBP até 3 MB.'));
    }
    mount(el('section', { class: 'box' },
      el('p', {}, el('a', { href: '#/cafeterias' }, '← Cafeterias')),
      el('div', { class: 'cafe-head' }, cafeAvatar(c, 'lg'), el('div', {}, el('h1', {}, c.name), el('p', { class: 'muted' }, 'Login: ', el('code', {}, c.username || '—'), ' · ', c.total_checkins, ' check-ins'))),
      msg,
      el('form', { onsubmit: async (ev) => {
        ev.preventDefault();
        try { const r = await API.post('admin/cafe/update', { id: c.id, name: f.name.value, address: f.address.value, combo_name: f.combo_name.value,
                combo_description: f.combo_description.value, maps_link: f.maps_link.value, lat: f.lat.value, lng: f.lng.value });
              f.maps_link.value = ''; f.lat.value = r.lat ?? ''; f.lng.value = r.lng ?? ''; say('Dados salvos.'); }
        catch (e) { say(e.message, true); }
      } },
        el('h2', {}, 'Dados e combo'),
        field('Nome', f.name), field('Endereço', f.address), field('Nome do combo', f.combo_name), field('Descrição do combo', f.combo_description),
        el('h2', {}, 'Localização no mapa'),
        field('Link do Google Maps', f.maps_link, 'Abra o local no Google Maps (computador), copie o link da barra de endereço e cole aqui.'),
        el('div', { class: 'row2' }, field('Latitude', f.lat), field('Longitude', f.lng)),
        safeUrl(c.maps_url) ? el('p', { class: 'small' }, el('a', { href: safeUrl(c.maps_url), target: '_blank', rel: 'noopener' }, 'Pesquisar este endereço no Google Maps ↗')) : null,
        el('button', { class: 'btn' }, 'Salvar dados')),
      el('h2', {}, 'Imagens'),
      el('div', { class: 'grid2' }, imgBlock('logo', 'Logo da cafeteria (lista)', c.logo_url), imgBlock('combo', 'Foto do combo (detalhe)', c.combo_photo_url)),
      el('h2', {}, 'Participação e acesso'),
      el('div', { class: 'actions-row' },
        act(Number(c.active) ? '⛔ Tirar da campanha' : '✅ Incluir na campanha', async () => { await API.post('admin/cafe/active', { id: c.id }); return 'Situação atualizada.'; },
          Number(c.active) ? 'A cafeteria some do app e deixa de contar para completar o passaporte. Confirmar?' : null, 'btn-sec'),
        c.staff_id ? act('🔑 Resetar senha', async () => { const r = await API.post('admin/cafe/reset', { staff_id: c.staff_id }); return 'Nova senha temporária de ' + c.username + ': ' + r.temp_password + ' (exibida só agora).'; }, 'Gerar nova senha?', 'btn-sec') : null,
        c.staff_id ? act(Number(c.staff_active) ? 'Bloquear login' : 'Desbloquear login', async () => { await API.post('admin/cafe/toggle', { staff_id: c.staff_id }); return 'Login atualizado.'; }, null, 'btn-sec') : null,
        act('♻️ Gerar novo QR', async () => { await API.post('admin/cafe/rotate-qr', { id: c.id }); return 'Novo QR gerado. IMPRIMA a nova placa — a antiga deixou de funcionar.'; }, 'A placa atual deixará de funcionar e precisará ser reimpressa. Confirmar?', 'btn-danger')),
      el('h2', {}, 'Placa QR'), plaque(c, c.plaque_url)));
    if (flash) { say(flash); flash = null; }
  }
  async function viewPlaques() {
    const d = await API.get('admin/cafes');
    mount(el('section', {},
      el('div', { class: 'box no-print' }, el('h1', {}, 'Placas QR para impressão'),
        el('p', {}, 'Uma placa por cafeteria ativa. Imprima em A4 (4 por folha) ou envie para a gráfica.'),
        el('button', { class: 'btn', onclick: () => window.print() }, '🖨️ Imprimir todas')),
      el('div', { class: 'plaques' }, d.cafes.filter(c => Number(c.active)).map(c => plaque(c, c.plaque_url)))));
  }
  async function viewAudit() {
    const d = await API.get('admin/audit');
    mount(el('section', { class: 'box' }, el('h1', {}, 'Auditoria (últimos 300 eventos)'),
      table(['Data', 'Ator', 'Ação', 'Detalhe'], d.events.map(e => [fmtDate(e.created_at), e.actor, e.action, e.detail]))));
  }

  async function router() {
    if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
    const { path, params } = hashRoute(); const st = S.staff;
    try {
      if (!st) return viewLogin();
      if (st.must_change || path === '/senha') return viewPassword();
      if (st.role === 'cafe') return await viewCafe();
      const admin = { '/': viewDashboard, '/ranking': viewRanking, '/clientes': viewUsers, '/cliente': viewUser,
        '/cafeterias': viewCafes, '/cafeteria': viewCafeEdit, '/placas': viewPlaques, '/auditoria': viewAudit };
      await (admin[path] || viewDashboard)(params);
    } catch (e) {
      if ([401, 403, 428].includes(e.status)) { S = await API.init(); nav(); return S.staff?.must_change ? viewPassword() : viewLogin(); }
      mount(alertBox(e.message, 'err'));
    }
  }
  try { S = await API.init(); } catch (e) { mount(alertBox('Não foi possível conectar à API: ' + e.message, 'err')); return; }
  nav(); window.addEventListener('hashchange', router); router();
})();
