/* Cliente da API JSON + utilidades de interface (dados sempre via textContent → evita XSS) */
const API = {
  csrf: null, session: null,
  async init() { this.session = await this.get('session'); this.csrf = this.session.csrf; return this.session; },
  async request(method, action, data, isForm) {
    const opt = { method, credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
    if (method === 'POST') {
      opt.headers['X-CSRF-Token'] = this.csrf || '';
      if (isForm) opt.body = data;
      else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(data || {}); }
    }
    let url = 'api.php?action=' + encodeURIComponent(action);
    if (method === 'GET' && data) url += '&' + new URLSearchParams(data).toString();
    let res;
    try { res = await fetch(url, opt); }
    catch { const e = new Error('Sem conexão. Verifique a internet e tente novamente.'); e.status = 0; throw e; }
    const json = await res.json().catch(() => ({ ok: false, error: 'Resposta inválida do servidor (verifique se o PHP está rodando e o config.php existe).' }));
    if (json.csrf) this.csrf = json.csrf;
    if (!res.ok || json.ok === false) { const e = new Error(json.error || 'Erro ' + res.status); e.status = res.status; e.data = json; throw e; }
    return json;
  },
  get(a, p) { return this.request('GET', a, p); },
  post(a, d) { return this.request('POST', a, d); },
  upload(a, formData) { return this.request('POST', a, formData, true); }
};
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false)
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
function mount(...nodes) { document.getElementById('view').replaceChildren(...nodes); window.scrollTo(0, 0); }
function alertBox(msg, type) { return el('p', { class: 'alert ' + (type || '') }, msg); }
function fmtDate(s, withTime = true) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  return withTime ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
}
function hashRoute() {
  const [path, qs] = (location.hash.replace(/^#/, '') || '/').split('?');
  return { path, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function safeUrl(u) {
  if (!u) return null;
  try { const x = new URL(u, location.href); return ['https:', 'http:'].includes(x.protocol) ? x.href : null; } catch { return null; }
}
function initials(name) { return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''); }
function cafeAvatar(c, cls) {
  return c.logo_url ? el('img', { class: 'avatar ' + (cls || ''), src: safeUrl(c.logo_url), alt: 'Logo ' + c.name, loading: 'lazy' })
                    : el('div', { class: 'avatar ph ' + (cls || ''), 'aria-hidden': 'true' }, initials(c.name));
}
document.getElementById('menu-btn')?.addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
