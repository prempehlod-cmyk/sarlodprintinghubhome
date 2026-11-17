/* SARLOD Printing Hub - core: device storage, online sync, sign-in, header/logo, slideshows */
(function () {
'use strict';
const API = '/.netlify/functions/sync';
const DEF_SALT = 'sarlod-default-admin';
const DEF_HASH_NOTE = 1; // updated:1 marks the untouched default admin record

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => Date.now();
const money = n => 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---------------- defaults ---------------- */
const DEFAULT_SITE = {
  company: 'SARLOD PRINTING HUB', place: 'Yabi',
  motto: 'We lead; God our leader',
  address: 'Atwima-Yabi, opposite Yabi M/A Primary School, off the Yabi-Twedie road',
  phone1: '0246973733', phone2: '0243610042', whatsapp: '0539346107', email: 'sarlod2024@gmail.com',
  hours: 'Call or WhatsApp us to confirm opening hours.',
  about: 'SARLOD Printing Hub is a printing and document-services shop in Yabi, in the Atwima area. We serve schools, churches, businesses and families with everyday printing and copying, and with bigger jobs such as banners, programmes, invitation cards and branded materials.\n\nEvery job is checked before it leaves the shop, and customers are told the price and the pick-up time up front. We work by one motto: We lead; God our leader.',
  logo: null, headerImages: [],
  holders: [
    { id: 'h-home', page: 'home', title: 'From our press', size: 'wide', images: [] },
    { id: 'h-gallery', page: 'gallery', title: 'Our work', size: 'wide', images: [] }
  ],
  services: [
    { t: 'Printing & photocopying', d: 'Black-and-white and colour prints and copies in A4, A3 and other sizes, single sheets or bulk.' },
    { t: 'Banners & large format', d: 'Flex banners, posters and signboards for shops, churches, events and campaigns.' },
    { t: 'Invitations, programmes & cards', d: 'Wedding and funeral programmes, invitation cards, business cards, brochures and flyers.' },
    { t: 'Scanning, typing & design', d: 'Document typing, scanning, layout and simple graphic design for your print jobs.' },
    { t: 'Lamination & binding', d: 'Lamination, spiral binding and neat finishing for certificates, reports and project work.' },
    { t: 'School & church documents', d: 'Exam papers, lesson notes, assessment sheets, bulletins and registers printed in quantity.' }
  ]
};
const JOB_STATUS = ['Received', 'In progress', 'Ready', 'Delivered', 'Cancelled'];

/* ---------------- device storage (IndexedDB, with localStorage fallback) ---------------- */
const KV = {
  db: null, mem: {},
  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('sarlod-hub', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      this.mem = await new Promise(res => {
        const out = {}; const c = this.db.transaction('kv').objectStore('kv').openCursor();
        c.onsuccess = e => { const cur = e.target.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); };
        c.onerror = () => res(out);
      });
    } catch (e) {
      this.db = null;
      try { this.mem = JSON.parse(localStorage.getItem('sarlod-kv') || '{}'); } catch (_) { this.mem = {}; }
    }
  },
  get(k) { return this.mem[k]; },
  set(k, v) {
    this.mem[k] = v;
    if (this.db) { try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) {} }
    else { try { localStorage.setItem('sarlod-kv', JSON.stringify(this.mem)); } catch (e) { App.toast('Device storage is full. Remove some pictures.', 'err'); } }
  }
};

/* ---------------- collections ---------------- */
const COLS = ['jobs', 'enquiries', 'reports', 'staff'];
const all = c => KV.get('c:' + c) || [];
const list = c => all(c).filter(r => !r.del);
function merge(a, b) {
  const m = new Map();
  for (const r of [...(a || []), ...(b || [])]) {
    if (!r || !r.id) continue;
    const o = m.get(r.id);
    if (!o || (r.updated || 0) >= (o.updated || 0)) m.set(r.id, r);
  }
  return [...m.values()];
}
function put(c, rec) {
  rec.updated = now();
  const a = all(c).slice(); const i = a.findIndex(x => x.id === rec.id);
  if (i >= 0) a[i] = rec; else a.push(rec);
  KV.set('c:' + c, a); changed(); return rec;
}
const del = (c, id) => put(c, { id, del: 1 });
function defaultAdmin() { return { id: 'ADMIN', name: 'Administrator', role: 'admin', salt: DEF_SALT, hash: KV.get('defhash'), updated: DEF_HASH_NOTE }; }

/* ---------------- site settings and pictures ---------------- */
const site = () => Object.assign({}, DEFAULT_SITE, (KV.get('site') || {}).data || {});
function setSite(patch) {
  KV.set('site', { updated: now(), data: Object.assign({}, site(), patch) });
  changed();
}
const imgSrc = id => (id ? KV.get('img:' + id) : null) || null;
function fileToDataURL(file, max = 1280, q = 0.8, keepAlpha = false) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); if (!keepAlpha) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', q));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Not a readable picture')); };
    im.src = url;
  });
}
async function addImage(file, opts = {}) {
  const data = await fileToDataURL(file, opts.max || 1280, opts.q || 0.8, !!opts.alpha);
  const id = uid();
  KV.set('img:' + id, data);
  KV.set('imgq', (KV.get('imgq') || []).concat(id));
  return id;
}

/* ---------------- sign-in ---------------- */
const Auth = {
  get() { try { return JSON.parse(sessionStorage.getItem('sph-sess') || 'null'); } catch (e) { return null; } },
  set(s) { try { sessionStorage.setItem('sph-sess', JSON.stringify(s)); } catch (e) {} },
  clear() { try { sessionStorage.removeItem('sph-sess'); } catch (e) {} },
  async hash(pw, salt) {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256);
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  },
  async login(id, pw) {
    id = id.trim().toUpperCase();
    try {
      const r = await fetch(API + '?action=salt&id=' + encodeURIComponent(id));
      if (r.ok) {
        const { salt } = await r.json();
        const hash = await this.hash(pw, salt);
        const lr = await fetch(API + '?action=login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, hash }) });
        if (lr.ok) {
          const d = await lr.json();
          KV.set('cred:' + d.me.id, d.me);
          this.set({ id: d.me.id, name: d.me.name, role: d.me.role, token: d.token });
          return { ok: true, online: true };
        }
        if (lr.status === 401) { KV.set('cred:' + id, null); return { ok: false, msg: 'Wrong ID or password.' }; }
      }
    } catch (e) { /* server not reachable: use this device */ }
    const u = list('staff').find(x => x.id === id) || KV.get('cred:' + id);
    if (!u || !u.hash) return { ok: false, msg: 'Wrong ID or password.' };
    const signedInBefore = Object.keys(KV.mem).some(k => k.startsWith('cred:') && KV.mem[k]);
    if (u.updated === DEF_HASH_NOTE && signedInBefore) return { ok: false, msg: 'Wrong ID or password.' };
    if ((await this.hash(pw, u.salt)) !== u.hash) return { ok: false, msg: 'Wrong ID or password.' };
    this.set({ id: u.id, name: u.name, role: u.role, token: null });
    return { ok: true, online: false };
  },
  require(role) {
    const s = this.get();
    if (!s) { location.replace('staff.html?next=' + encodeURIComponent(location.pathname.split('/').pop())); return null; }
    if (role === 'admin' && s.role !== 'admin') { location.replace('portal.html'); return null; }
    return s;
  },
  logout() { this.clear(); location.href = 'staff.html'; }
};

/* ---------------- device + online saving ---------------- */
const Sync = {
  state: 'local', last: null, listeners: [], timer: null, busy: false,
  on(fn) { this.listeners.push(fn); fn(this.info()); },
  info() { return { state: this.state, last: this.last }; },
  set(state) { this.state = state; if (state === 'synced') this.last = new Date(); this.listeners.forEach(f => f(this.info())); },
  async call(action, body, token) {
    const r = await fetch(API + '?action=' + action, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) { const e = new Error('http ' + r.status); e.status = r.status; throw e; }
    return r.json();
  },
  siteIds(d) {
    const ids = new Set([d.logo, ...(d.headerImages || [])]);
    (d.holders || []).forEach(h => (h.images || []).forEach(i => ids.add(i)));
    return [...ids].filter(Boolean);
  },
  async fetchMissingImages() {
    let got = false;
    const miss = this.siteIds(site()).filter(i => !KV.get('img:' + i));
    await Promise.all(miss.map(async id => {
      try { const d = await this.call('img&id=' + id); if (d.data) { KV.set('img:' + id, d.data); got = true; } } catch (e) {}
    }));
    return got;
  },
  async pullPublic() {
    let changedSomething = false;
    try {
      const d = await this.call('public');
      this.server = true;
      const local = KV.get('site');
      if (d.site && (!local || d.site.updated > local.updated)) { KV.set('site', d.site); changedSomething = true; }
      if (await this.fetchMissingImages()) changedSomething = true;
    } catch (e) { this.server = false; }
    return changedSomething;
  },
  async sendOutbox() {
    const q = KV.get('outbox') || []; if (!q.length) return;
    const left = [];
    for (const rec of q) {
      try { await this.call('enquiry', rec); } catch (e) { left.push(rec); }
    }
    KV.set('outbox', left);
  },
  async run() {
    const s = Auth.get();
    if (!s || !s.token) { this.set('local'); return; }
    if (!navigator.onLine) { this.set('offline'); return; }
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.set('syncing');
    try {
      if (s.role === 'admin') {
        for (const id of (KV.get('imgq') || []).slice()) {
          const data = KV.get('img:' + id);
          if (data) await this.call('putimg', { id, data }, s.token);
          KV.set('imgq', (KV.get('imgq') || []).filter(x => x !== id));
        }
      }
      const cols = {};
      COLS.filter(c => c !== 'staff' || s.role === 'admin').forEach(c => { cols[c] = all(c); });
      const res = await this.call('sync', { cols, site: s.role === 'admin' ? KV.get('site') : null }, s.token);
      for (const c in res.cols) KV.set('c:' + c, merge(all(c), res.cols[c]));
      const local = KV.get('site');
      if (res.site && (!local || res.site.updated > local.updated)) KV.set('site', res.site);
      await this.fetchMissingImages();
      this.set('synced'); App.refresh && App.refresh();
    } catch (e) {
      if (e.status === 401) { s.token = null; Auth.set(s); this.set('expired'); }
      else this.set(navigator.onLine ? 'error' : 'offline');
    }
    this.busy = false;
    if (this.again) { this.again = false; this.schedule(800); }
  },
  schedule(ms = 1500) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); }
};
function changed() { Sync.schedule(); if (!Auth.get()?.token) Sync.set('local'); }
window.addEventListener('online', () => Sync.run());
document.addEventListener('visibilitychange', () => { if (!document.hidden) Sync.run(); });

/* ---------------- slideshow with random transitions ---------------- */
const rev = (a, b) => [a, b];
const FX = {
  fade: { in: [{ opacity: 0 }, { opacity: 1 }] },
  slideL: { in: [{ transform: 'translateX(100%)' }, { transform: 'none' }], out: [{ transform: 'none' }, { transform: 'translateX(-100%)' }] },
  slideR: { in: [{ transform: 'translateX(-100%)' }, { transform: 'none' }], out: [{ transform: 'none' }, { transform: 'translateX(100%)' }] },
  slideU: { in: [{ transform: 'translateY(100%)' }, { transform: 'none' }], out: [{ transform: 'none' }, { transform: 'translateY(-100%)' }] },
  slideD: { in: [{ transform: 'translateY(-100%)' }, { transform: 'none' }], out: [{ transform: 'none' }, { transform: 'translateY(100%)' }] },
  zoomIn: { in: [{ opacity: 0, transform: 'scale(1.5)' }, { opacity: 1, transform: 'none' }] },
  zoomOut: { in: [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }] },
  flip: { in: [{ opacity: 0, transform: 'perspective(900px) rotateY(90deg)' }, { opacity: 1, transform: 'none' }], out: [{ opacity: 1 }, { opacity: 0, transform: 'perspective(900px) rotateY(-90deg)' }] },
  spin: { in: [{ opacity: 0, transform: 'rotate(-30deg) scale(.3)' }, { opacity: 1, transform: 'none' }] },
  blur: { in: [{ opacity: 0, filter: 'blur(26px)' }, { opacity: 1, filter: 'blur(0)' }] },
  wipe: { in: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }] },
  iris: { in: [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }] },
  blinds: { in: [{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }] }
};
const FXN = Object.keys(FX);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
function placeholder(i) {
  const th = [['#00a8e8', '#0b1b3a', 'Printing and copying'], ['#e6007e', '#2a0b26', 'Banners and flex'], ['#ffd400', '#3a2f0b', 'Cards and invitations'], ['#16306a', '#00a8e8', 'Scan · Type · Laminate']][i % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th[1]}"/><stop offset="1" stop-color="${th[0]}"/></linearGradient><pattern id="d" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="3" fill="#fff" fill-opacity=".18"/><circle cx="21" cy="21" r="3" fill="#fff" fill-opacity=".12"/></pattern></defs><rect width="800" height="450" fill="url(#g)"/><rect width="800" height="450" fill="url(#d)"/><circle cx="640" cy="150" r="90" fill="#00a8e8" fill-opacity=".75" style="mix-blend-mode:screen"/><circle cx="700" cy="220" r="90" fill="#e6007e" fill-opacity=".75" style="mix-blend-mode:screen"/><circle cx="600" cy="230" r="90" fill="#ffd400" fill-opacity=".75" style="mix-blend-mode:screen"/><text x="48" y="360" font-family="Arial Black,Arial,sans-serif" font-size="58" fill="#fff">${th[2]}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function slideshow(el, srcs, opt = {}) {
  if (el._ss) { clearInterval(el._ss); el._ss = null; }
  el.classList.add('ss'); el.innerHTML = '';
  if (!srcs.length) return;
  const mk = src => { const im = new Image(); im.src = src; im.alt = ''; im.decoding = 'async'; return im; };
  let cur = 0, last = '', stage = mk(srcs[0]);
  el.appendChild(stage);
  if (srcs.length < 2) return;
  const dur = opt.dur || 1200;
  el._ss = setInterval(() => {
    if (document.hidden) return;
    cur = (cur + 1) % srcs.length;
    let name; do { name = calm ? 'fade' : FXN[Math.floor(Math.random() * FXN.length)]; } while (name === last && FXN.length > 1 && !calm);
    last = name; const fx = FX[name];
    const old = stage; const nxt = mk(srcs[cur]); nxt.style.zIndex = 2; el.appendChild(nxt);
    const opts = { duration: dur, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' };
    nxt.animate(fx.in, opts);
    if (fx.out) old.animate(fx.out, opts);
    stage = nxt;
    setTimeout(() => { old.remove(); nxt.style.zIndex = ''; }, dur + 80);
  }, opt.interval || 4200);
}

/* ---------------- shared page chrome ---------------- */
const NAV = [['index.html', 'Home', 'home'], ['about.html', 'About us', 'about'], ['services.html', 'Services', 'services'], ['gallery.html', 'Gallery', 'gallery'], ['contact.html', 'Contact', 'contact'], ['enquiry.html', 'Customers Enquiry', 'enquiry'], ['staff.html', 'Staff', 'staff']];
const wa = n => '233' + String(n).replace(/\D/g, '').replace(/^0/, '');
const sparkG = (x, y, k, dl, fill) => `<g transform="translate(${x} ${y}) scale(${k})"><path class="spark" style="animation-delay:${dl}s;fill:${fill}" d="M0-12L3-3L12 0L3 3L0 12L-3 3L-12 0L-3-3Z"/></g>`;
function logoHTML(s) {
  const custom = imgSrc(s.logo);
  if (custom) return `<img src="${custom}" alt="${esc(s.company)} logo">`;
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(s.company)} logo"><defs>
<radialGradient id="lgb" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="#27489a"/><stop offset="1" stop-color="#071230"/></radialGradient>
<linearGradient id="lgr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd400"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#e6007e"/></linearGradient></defs>
<circle cx="100" cy="100" r="94" fill="url(#lgb)" stroke="url(#lgr)" stroke-width="5"/>
<g style="mix-blend-mode:screen"><circle cx="100" cy="66" r="38" fill="#00a8e8"/><circle cx="73" cy="108" r="38" fill="#e6007e"/><circle cx="127" cy="108" r="38" fill="#ffd400"/></g>
<text x="100" y="128" text-anchor="middle" font-family="Archivo Black,Arial Black,Arial,sans-serif" font-size="92" fill="#fff" stroke="#0b1b3a" stroke-width="5" paint-order="stroke">S</text>
<text x="100" y="166" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-weight="800" font-size="12" letter-spacing="2.4" fill="#fff">PRINTING HUB</text>
${sparkG(26, 56, 1.1, 0, '#fff')}${sparkG(172, 44, 1.5, .35, '#ffd400')}${sparkG(160, 150, .9, .8, '#fff')}${sparkG(38, 146, 1.2, 1.15, '#9fe4ff')}${sparkG(104, 12, 1, 1.5, '#ffd400')}</svg>`;
}
function chrome(page) {
  const s = site();
  const nav = NAV.map(([h, t, k]) => `<li><a href="${h}" class="${k === 'staff' ? 'staff ' : ''}${page === k ? 'on' : ''}">${t}</a></li>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<header class="top" id="top">
  <div class="top-bg plain" id="hdrBg"></div><span class="flash" aria-hidden="true"></span>
  <div class="wrap top-inner">
    <a class="logo" href="index.html" id="logoBox">${logoHTML(s)}</a>
    <div class="brand"><h1 class="co" data-s="company">${esc(s.company)}</h1><span class="loc" data-s="place">${esc(s.place)}</span></div>
    <div class="top-side"><a href="tel:${esc(s.phone1)}" data-s="phone1">${esc(s.phone1)}</a><a href="tel:${esc(s.phone2)}" data-s="phone2">${esc(s.phone2)}</a></div>
  </div></header>
<nav class="nav" aria-label="Main menu"><div class="wrap"><button class="burger" type="button" aria-expanded="false" id="burger">Menu ☰</button><ul id="menu">${nav}</ul></div></nav>`);
  $('#burger').addEventListener('click', e => { const m = $('#menu'); const o = m.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); });
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><div class="foot-grid">
  <div><h4>Visit us</h4><span data-s="address">${esc(s.address)}</span></div>
  <div><h4>Call or WhatsApp</h4><span id="fPhones"></span></div>
  <div><h4>Email</h4><a id="fMail" href="mailto:${esc(s.email)}">${esc(s.email)}</a></div></div>
  <div class="small"><span data-s="motto">${esc(s.motto)}</span> · © <span id="yr"></span> <span data-s="company">${esc(s.company)}</span></div></div></footer>
<div id="printArea"></div><div id="toast" style="position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:999"></div>`);
  $('#yr').textContent = new Date().getFullYear();
}
function applySite() {
  const s = site();
  $$('[data-s]').forEach(e => { e.textContent = s[e.dataset.s] ?? ''; });
  $$('[data-tel]').forEach(e => { const v = s[e.dataset.tel]; e.textContent = v; e.href = 'tel:' + v; });
  $$('[data-wa]').forEach(e => { e.href = 'https://wa.me/' + wa(s.whatsapp); });
  $$('[data-mail]').forEach(e => { e.textContent = s.email; e.href = 'mailto:' + s.email; });
  const fp = $('#fPhones'); if (fp) fp.innerHTML = `<a href="tel:${esc(s.phone1)}">${esc(s.phone1)}</a> / <a href="tel:${esc(s.phone2)}">${esc(s.phone2)}</a><br>WhatsApp: <a href="https://wa.me/${wa(s.whatsapp)}">${esc(s.whatsapp)}</a>`;
  const fm = $('#fMail'); if (fm) { fm.href = 'mailto:' + s.email; fm.textContent = s.email; }
  document.title = (document.body.dataset.title ? document.body.dataset.title + ' | ' : '') + s.company + ', ' + s.place;
  // logo
  const lb = $('#logoBox'); const key = s.logo || 'default';
  if (lb && lb.dataset.k !== key + (imgSrc(s.logo) ? 'y' : 'n')) { lb.innerHTML = logoHTML(s); lb.dataset.k = key + (imgSrc(s.logo) ? 'y' : 'n'); }
  // header pictures
  const hb = $('#hdrBg');
  if (hb) {
    const srcs = (s.headerImages || []).map(imgSrc).filter(Boolean); const k = srcs.length + ':' + (s.headerImages || []).join();
    if (hb.dataset.k !== k) {
      hb.dataset.k = k;
      if (srcs.length) { hb.classList.remove('plain'); const box = document.createElement('div'); box.style.cssText = 'position:absolute;inset:0'; const o1 = hb.querySelector('.ss'); if (o1) { clearInterval(o1._ss); o1.remove(); } hb.prepend(box); slideshow(box, srcs, { interval: 5200, dur: 1600 }); }
      else { hb.classList.add('plain'); const o2 = hb.querySelector('.ss'); if (o2) { clearInterval(o2._ss); o2.remove(); } }
    }
  }
  $$('[data-services]').forEach(box => {
    const n = +box.dataset.services || 99;
    box.innerHTML = (s.services || []).slice(0, n).map(v => `<article class="card svc"><div class="dot"></div><h3>${esc(v.t)}</h3><p>${esc(v.d)}</p></article>`).join('');
  });
  const sel = $('#enqService');
  if (sel && sel.dataset.k !== JSON.stringify(s.services.map(v => v.t))) { const cur = sel.value; sel.dataset.k = JSON.stringify(s.services.map(v => v.t)); sel.innerHTML = '<option value="">Choose a service</option>' + s.services.map(v => `<option>${esc(v.t)}</option>`).join('') + '<option>Something else</option>'; sel.value = cur; }
  // motto marquee
  const mt = $('#mottoTrack');
  if (mt) { const t = s.motto; const html = Array(8).fill(`<span>${esc(t)}</span>`).join(''); if (mt.dataset.k !== t) { mt.dataset.k = t; mt.innerHTML = html + html; } }
  // holders
  $$('[data-holders]').forEach(box => {
    const page = box.dataset.holders;
    const hs = (s.holders || []).filter(h => h.page === page);
    const key = JSON.stringify(hs) + hs.map(h => (h.images || []).filter(i => imgSrc(i)).length).join();
    if (box.dataset.k === key) return; box.dataset.k = key;
    box.innerHTML = '';
    hs.forEach((h, n) => {
      const f = document.createElement('figure'); f.className = 'holder ' + (h.size || 'wide');
      const stage = document.createElement('div'); f.appendChild(stage);
      if (h.title) f.insertAdjacentHTML('beforeend', `<figcaption>${esc(h.title)}</figcaption>`);
      box.appendChild(f);
      const srcs = (h.images || []).map(imgSrc).filter(Boolean);
      slideshow(stage, srcs.length ? srcs : [0, 1, 2, 3].map(i => placeholder(i + n)), { interval: 3800 + n * 600 });
    });
  });
  // gallery grid
  const gg = $('#galleryGrid');
  if (gg) {
    const srcs = (s.holders || []).filter(h => h.page === 'gallery').flatMap(h => h.images || []).map(imgSrc).filter(Boolean);
    const k = srcs.length; if (gg.dataset.k !== String(k)) {
      gg.dataset.k = String(k);
      gg.innerHTML = srcs.length ? srcs.map((u, i) => `<li style="list-style:none"><button type="button" data-i="${i}" aria-label="Open picture ${i + 1}"><img src="${u}" alt="Picture ${i + 1} of our work" loading="lazy"></button></li>`).join('') : '';
      const sec = $('#gallerySec'); if (sec) sec.hidden = !srcs.length;
      gg._srcs = srcs;
    }
  }
}
function toast(msg, kind) {
  const t = $('#toast'); if (!t) return;
  const d = document.createElement('div');
  d.style.cssText = 'background:' + (kind === 'err' ? '#c4172c' : '#0b1b3a') + ';color:#fff;padding:10px 18px;border-radius:999px;font:700 .9rem Archivo,Arial,sans-serif;margin-top:8px;box-shadow:0 8px 24px rgba(0,0,0,.3)';
  d.textContent = msg; t.appendChild(d); setTimeout(() => d.remove(), 3200);
}

/* ---------------- csv + files ---------------- */
function toCSV(rows, cols) {
  const q = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [cols.map(c => q(c[1])).join(',')].concat(rows.map(r => cols.map(c => q(r[c[0]])).join(','))).join('\r\n');
}
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x !== ''));
}
async function saveFile(name, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function printHTML(html) {
  const pa = $('#printArea'); const s = site();
  pa.innerHTML = `<div class="ph"><h1>${esc(s.company)}, ${esc(s.place)}</h1><div>${esc(s.address)} · ${esc(s.phone1)} / ${esc(s.phone2)}</div></div>` + html;
  document.body.classList.add('print-mode');
  const done = () => { document.body.classList.remove('print-mode'); pa.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 60);
}

/* ---------------- start-up ---------------- */
const App = {
  KV, Auth, Sync, COLS, JOB_STATUS, $, $$, esc, uid, now, money, today, list, all, put, del, merge, site, setSite, imgSrc, addImage,
  slideshow, toast, toCSV, parseCSV, saveFile, printHTML, applySite, wa, DEF_SALT, refresh: null,
  async boot(page, opt = {}) {
    await KV.init();
    if (!KV.get('defhash')) {
      KV.set('defhash', await Auth.hash('sarlod123', DEF_SALT));
    }
    if (!all('staff').length) KV.set('c:staff', [defaultAdmin()]);
    if (opt.portal) { this.refresh = opt.onRefresh || null; Sync.run(); setInterval(() => Sync.run(), 45000); return; }
    chrome(page);
    applySite();
    this.refresh = applySite;
    Sync.pullPublic().then(c => c && applySite());
    Sync.sendOutbox();
    setInterval(() => Sync.pullPublic().then(c => c && applySite()), 120000);
    window.addEventListener('online', () => { Sync.sendOutbox(); Sync.pullPublic().then(c => c && applySite()); });
    const gg = $('#galleryGrid');
    if (gg) gg.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      const dlg = $('#lightbox'); $('img', dlg).src = gg._srcs[+b.dataset.i]; dlg.showModal();
    });
    const lb = $('#lightbox'); if (lb) lb.addEventListener('click', () => lb.close());
  }
};
window.App = App;
})();
