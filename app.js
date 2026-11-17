/* SARLOD Printing Hub - core script (public site + shared helpers) */
(function () {
'use strict';

var CFG = {
  name: 'SARLOD PRINTING HUB',
  town: 'Gabi',
  motto: 'We lead; God our leader',
  loc: 'Atwima-Yabi, opposite Yabi M/A Primary Sch, off Yabi-Twedie road',
  phones: ['0246973733', '0243610042'],
  wa: '0539346107',
  email: 'sarlod2024@gmail.com',
  defaultAdminPass: 'sarlod@2026'
};

/* ---------- helpers ---------- */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var money = function (n) { return 'GH\u20B5 ' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
var pad = function (n, l) { return String(n).padStart(l || 2, '0'); };
var todayStr = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
var nowTime = function () { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
var intl = function (n) { return '233' + String(n).replace(/\D/g, '').replace(/^0/, ''); };

var LS = {
  get: function (k, d) { try { var v = localStorage.getItem('sph_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('sph_' + k, JSON.stringify(v)); return true; } catch (e) { toast('Could not save - browser storage is full or blocked.', 'err'); return false; } }
};
var SS = {
  get: function () { try { return JSON.parse(sessionStorage.getItem('sph_session') || 'null'); } catch (e) { return null; } },
  set: function (v) { try { sessionStorage.setItem('sph_session', JSON.stringify(v)); } catch (e) {} },
  clear: function () { try { sessionStorage.removeItem('sph_session'); } catch (e) {} }
};

/* password hashing (client-side only - see README) */
function hash(id, pw) {
  var s = 'sph|' + String(id).toLowerCase() + '|' + pw, h1 = 0xdeadbeef ^ 7, h2 = 0x41c6ce57 ^ 7;
  for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function initData() {
  if (!LS.get('staff')) {
    LS.set('staff', [{ id: 'ADMIN', name: 'Administrator', role: 'admin', active: true, ph: hash('ADMIN', CFG.defaultAdminPass) }]);
  }
}

/* ---------- auth ---------- */
function me() { return SS.get(); }
function isAdmin() { var s = me(); return !!(s && s.role === 'admin'); }
function login(id, pw) {
  id = String(id || '').trim();
  var st = LS.get('staff', []).filter(function (x) { return x.id.toLowerCase() === id.toLowerCase(); })[0];
  if (!st || !st.active || st.ph !== hash(st.id, pw)) return null;
  var s = { id: st.id, name: st.name, role: st.role, t: Date.now() };
  SS.set(s); return s;
}
function logout(to) { SS.clear(); location.href = to || 'index.html'; }

/* ---------- toast / modal / print / csv ---------- */
function toast(msg, kind) {
  var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200);
}
function modal(title, html, opts) {
  opts = opts || {};
  var b = document.createElement('div'); b.className = 'modal-back no-print';
  b.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '"><div class="modal-h"><h3>' + esc(title) + '</h3><button class="modal-x" aria-label="Close">&times;</button></div><div class="modal-b">' + html + '</div></div>';
  document.body.appendChild(b);
  var close = function () { b.remove(); };
  $('.modal-x', b).onclick = close;
  b.addEventListener('mousedown', function (e) { if (e.target === b) close(); });
  return { el: b, close: close };
}
function printHTML(html) {
  var f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  var d = f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(function () { f.remove(); }, 1500); }, 300);
}
function csv(name, rows) {
  var t = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
  var b = new Blob(['\ufeff' + t], { type: 'text/csv' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function downloadText(name, text, type) {
  var b = new Blob([text], { type: type || 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- picture storage (IndexedDB) ---------- */
var _db;
function db() {
  return _db || (_db = new Promise(function (res, rej) {
    if (!window.indexedDB) return rej(new Error('no idb'));
    var r = indexedDB.open('sph_pics', 1);
    r.onupgradeneeded = function () { var s = r.result.createObjectStore('pics', { keyPath: 'id' }); s.createIndex('holder', 'holder'); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  }));
}
function tx(mode, fn) {
  return db().then(function (d) {
    return new Promise(function (res, rej) {
      var t = d.transaction('pics', mode), rq = fn(t.objectStore('pics'));
      t.oncomplete = function () { res(rq && rq.result); };
      t.onerror = function () { rej(t.error); };
    });
  });
}
var Pics = {
  put: function (p) { return tx('readwrite', function (s) { return s.put(p); }); },
  get: function (id) { return tx('readonly', function (s) { return s.get(id); }); },
  del: function (id) { return tx('readwrite', function (s) { return s.delete(id); }); },
  byHolder: function (h) { return tx('readonly', function (s) { return s.index('holder').getAll(h); }); },
  delHolder: function (h) { return Pics.byHolder(h).then(function (a) { return Promise.all((a || []).map(function (p) { return Pics.del(p.id); })); }); }
};
function fileToData(file, max, type, q) {
  return new Promise(function (res, rej) {
    var fr = new FileReader(); fr.onerror = rej;
    fr.onload = function () {
      var im = new Image(); im.onerror = rej;
      im.onload = function () {
        var k = Math.min(1, max / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var x = c.getContext('2d');
        if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
        x.drawImage(im, 0, 0, w, h); res(c.toDataURL(type, q));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function pickFiles(multiple) {
  return new Promise(function (res) {
    var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multiple;
    i.onchange = function () { res(Array.prototype.slice.call(i.files)); };
    i.click();
  });
}

/* ---------- default content ---------- */
var DEFAULT_SERVICES = [
  { ico: '\uD83D\uDDA8\uFE0F', t: 'Digital & Colour Printing', d: 'Documents, brochures, booklets, letterheads and more in black & white or full colour.' },
  { ico: '\uD83E\uDEAA', t: 'Business Cards & Stationery', d: 'Business cards, compliment slips, envelopes and branded office stationery.' },
  { ico: '\uD83C\uDFF3\uFE0F', t: 'Banners, Flex & Posters', d: 'Large-format banners, flex prints, posters and signage for events and shops.' },
  { ico: '\uD83D\uDCC4', t: 'Flyers & Handbills', d: 'Eye-catching flyers and handbills for church programmes, businesses and events.' },
  { ico: '\uD83D\uDCCB', t: 'Photocopying & Scanning', d: 'Quick photocopying and document scanning.' },
  { ico: '\uD83D\uDCDA', t: 'Binding & Lamination', d: 'Spiral binding, thermal binding and lamination to protect and present your documents.' },
  { ico: '\uD83C\uDFA8', t: 'Graphic Design', d: 'Logos, layouts and designs prepared for print.' },
  { ico: '\uD83E\uDDFE', t: 'Receipt, Invoice & Programme Books', d: 'Custom receipt/invoice books, funeral and wedding programmes, and special-occasion prints.' }
];
var DEFAULT_ABOUT = 'SARLOD Printing Hub is a printing business located at Gabi in the Atwima-Yabi area, opposite Yabi M/A Primary School, off the Yabi-Twedie road.\n\nWe help individuals, schools, churches, businesses and organisations get their ideas onto paper and into the hands of the people who matter - from everyday printing and photocopying to banners, cards, programmes and custom stationery.\n\nOur motto, "We lead; God our leader", reflects how we work: with honesty, care and a commitment to serve every customer well.';
function getServices() { return LS.get('services', DEFAULT_SERVICES); }
function getAbout() { return LS.get('about', DEFAULT_ABOUT); }

/* ---------- logo ---------- */
function logoSVG() {
  return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SARLOD Printing Hub logo">' +
    '<defs><linearGradient id="lgBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a4fa3"/><stop offset="1" stop-color="#061a3d"/></linearGradient>' +
    '<linearGradient id="lgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e59a00"/></linearGradient></defs>' +
    '<circle cx="100" cy="100" r="97" fill="url(#lgGold)"/><circle cx="100" cy="100" r="89" fill="url(#lgBg)"/>' +
    '<circle cx="100" cy="100" r="82" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 5"/>' +
    '<circle cx="66" cy="30" r="6" fill="#00b4ff"/><circle cx="88" cy="25" r="6" fill="#ff2d9b"/><circle cx="112" cy="25" r="6" fill="#ffe600"/><circle cx="134" cy="30" r="6" fill="#111" stroke="#fff" stroke-width="1"/>' +
    '<rect x="62" y="44" width="76" height="26" rx="2" fill="#fff"/><path d="M70 52h60M70 60h44" stroke="#9fb3dd" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="38" y="66" width="124" height="42" rx="10" fill="#e8eefb"/><rect x="38" y="94" width="124" height="14" rx="7" fill="#c5d3f0"/>' +
    '<circle cx="148" cy="79" r="3.5" fill="#2ecc71"/><rect x="52" y="97" width="96" height="4" rx="2" fill="#0a2a5e"/>' +
    '<rect x="60" y="101" width="80" height="34" rx="2" fill="#fff" stroke="#9fb3dd"/><path d="M68 112h64" stroke="#d62839" stroke-width="3.5" stroke-linecap="round"/><path d="M68 120h50M68 127h58" stroke="#0a2a5e" stroke-width="3" stroke-linecap="round"/>' +
    '<text x="100" y="159" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="24" fill="url(#lgGold)" textLength="100" lengthAdjust="spacingAndGlyphs">SARLOD</text>' +
    '<text x="100" y="176" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="#fff" textLength="74" lengthAdjust="spacingAndGlyphs">PRINTING HUB</text></svg>';
}

/* ---------- page shells ---------- */
var NAV = [
  ['index.html', 'Home', 'home'], ['about.html', 'About Us', 'about'], ['services.html', 'Services', 'services'],
  ['gallery.html', 'Gallery', 'gallery'], ['contact.html', 'Contact', 'contact'],
  ['enquiry.html', 'Customers Enquiry', 'enquiry'], ['login.html', 'Staff', 'login']
];

function headerHTML(page) {
  var nav = NAV.map(function (n) {
    var href = n[0] === 'login.html' && me() ? 'portal.html' : n[0];
    return '<a href="' + href + '" class="' + (n[2] === page ? 'on' : '') + '">' + n[1] + '</a>';
  }).join('');
  var motto = '';
  if (page === 'home') {
    var seg = '<span>' + (esc(CFG.motto) + '<em>\u2726</em>').repeat(6) + '</span>';
    motto = '<div class="motto-bar" aria-label="Motto"><div class="motto-track">' + seg + seg + '</div></div>';
  }
  return '<header class="site-header" id="siteHeader"><div class="hdr-bg empty" id="hdrBg"></div><div class="hdr-shade"></div>' +
    '<div class="hdr-inner"><a class="logo-wrap" href="index.html" aria-label="SARLOD Printing Hub home"><span class="logo-flash"></span>' +
    '<span class="logo-core" id="logoCore">' + logoSVG() + '<span class="logo-clip"><span class="logo-shine"></span></span></span>' +
    '<i class="sp s1">\u2726</i><i class="sp s2">\u2726</i><i class="sp s3">\u2726</i><i class="sp s4">\u2726</i><i class="sp s5">\u2726</i><i class="sp s6">\u2726</i></a>' +
    '<div class="brand"><h1>SARLOD <span>Printing</span> Hub</h1><p>' + esc(CFG.town) + ' &middot; Atwima-Yabi</p></div>' +
    '<div class="hdr-contact">\uD83D\uDCDE <a href="tel:' + CFG.phones[0] + '">' + CFG.phones[0] + '</a><br>\uD83D\uDCDE <a href="tel:' + CFG.phones[1] + '">' + CFG.phones[1] + '</a><br>\uD83D\uDCAC <a href="https://wa.me/' + intl(CFG.wa) + '">WhatsApp</a></div></div></header>' +
    '<nav class="main-nav" aria-label="Main menu"><button class="nav-toggle" id="navToggle">\u2630 Menu</button><div class="nav-inner" id="navInner">' + nav + '</div></nav>' + motto;
}
function footerHTML() {
  return '<footer class="site-footer"><div class="container"><div class="foot-grid">' +
    '<div><h4>SARLOD Printing Hub</h4><p>Quality printing at Gabi, Atwima-Yabi.</p><p><i style="color:#f6b800">\u201C' + esc(CFG.motto) + '\u201D</i></p></div>' +
    '<div><h4>Find us</h4><p>' + esc(CFG.loc) + '</p></div>' +
    '<div><h4>Contact</h4><p>\uD83D\uDCDE <a href="tel:' + CFG.phones[0] + '">' + CFG.phones[0] + '</a> / <a href="tel:' + CFG.phones[1] + '">' + CFG.phones[1] + '</a><br>\uD83D\uDCAC <a href="https://wa.me/' + intl(CFG.wa) + '">WhatsApp ' + CFG.wa + '</a><br>\u2709\uFE0F <a href="mailto:' + CFG.email + '">' + CFG.email + '</a></p></div>' +
    '<div><h4>Quick links</h4><p><a href="services.html">Services</a><br><a href="gallery.html">Gallery</a><br><a href="enquiry.html">Customers Enquiry</a><br><a href="login.html">Staff Portal</a></p></div>' +
    '</div><div class="foot-bottom">&copy; ' + new Date().getFullYear() + ' SARLOD Printing Hub, Gabi &middot; <i>' + esc(CFG.motto) + '</i></div></div></footer>';
}

function adminBarHTML() {
  var s = me();
  return '<div class="adminbar no-print" id="adminBar"><b>\uD83D\uDD10 Administrator mode</b><span>' + esc(s.name) + '</span>' +
    '<button data-a="hdrpic">\uD83D\uDDBC Insert header picture</button><button data-a="hdrclear">Remove header picture</button>' +
    '<button data-a="logo">Upload logo</button><button data-a="logoreset">Reset logo</button>' +
    '<a href="portal.html">Staff Portal</a><a href="admin.html">Admin Panel</a><button data-a="out">Logout</button></div>';
}

async function applyBranding() {
  try {
    var h = await Pics.get('header'); var bg = $('#hdrBg');
    if (bg) { if (h) { bg.style.backgroundImage = 'url(' + h.data + ')'; bg.classList.remove('empty'); } else { bg.style.backgroundImage = ''; bg.classList.add('empty'); } }
    var l = await Pics.get('logo'); var core = $('#logoCore');
    if (core) {
      var cur = $('img.custom-logo', core), svg = $('svg', core);
      if (l) { if (!cur) { var im = new Image(); im.className = 'custom-logo'; im.alt = 'SARLOD Printing Hub logo'; im.src = l.data; core.insertBefore(im, core.firstChild); if (svg) svg.style.display = 'none'; } else cur.src = l.data; }
      else { if (cur) cur.remove(); if (svg) svg.style.display = ''; }
    }
  } catch (e) { /* storage unavailable - keep defaults */ }
}

function wireAdminBar() {
  var bar = $('#adminBar'); if (!bar) return;
  bar.addEventListener('click', async function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
    try {
      if (a === 'out') return logout('index.html');
      if (a === 'hdrpic') { var f = await pickFiles(false); if (!f[0]) return; await Pics.put({ id: 'header', holder: '_sys', data: await fileToData(f[0], 1800, 'image/jpeg', 0.82), t: Date.now() }); toast('Header picture inserted'); }
      if (a === 'hdrclear') { await Pics.del('header'); toast('Header picture removed'); }
      if (a === 'logo') { var g = await pickFiles(false); if (!g[0]) return; await Pics.put({ id: 'logo', holder: '_sys', data: await fileToData(g[0], 500, 'image/png', 1), t: Date.now() }); toast('Logo uploaded'); }
      if (a === 'logoreset') { await Pics.del('logo'); toast('Original logo restored'); }
      applyBranding();
    } catch (err) { toast('Could not save the picture. Try a smaller image.', 'err'); }
  });
}

function buildPublic(page) {
  document.body.insertAdjacentHTML('afterbegin', headerHTML(page) + (isAdmin() ? adminBarHTML() : ''));
  document.body.insertAdjacentHTML('beforeend', footerHTML());
  var t = $('#navToggle'); if (t) t.onclick = function () { $('#navInner').classList.toggle('open'); };
  wireAdminBar(); applyBranding();
}

function buildPortal(page) {
  var s = me();
  var links = [['portal.html', 'Dashboard', 'dash'], ['joblog.html', 'Job Log', 'joblog'], ['returns.html', 'Daily Returns', 'returns'], ['attendance.html', 'Attendance', 'attendance'], ['account.html', 'My Account', 'account']];
  if (s.role === 'admin') links.push(['admin.html', 'Admin Panel', 'admin']);
  document.body.insertAdjacentHTML('afterbegin',
    '<header class="portal-bar no-print"><a class="pb-logo" href="portal.html"><span class="mini">' + logoSVG() + '</span><span><b>SARLOD PRINTING HUB</b><small>Staff Portal</small></span></a>' +
    '<button class="adminbar-btn" id="pnToggle" style="display:none;background:#ffffff22;color:#fff;border:0;border-radius:8px;padding:6px 12px">\u2630</button>' +
    '<nav id="pn">' + links.map(function (l) { return '<a href="' + l[0] + '" class="' + (l[2] === page ? 'on' : '') + '">' + l[1] + '</a>'; }).join('') + '</nav>' +
    '<div class="pb-user">\uD83D\uDC64 ' + esc(s.name) + ' (' + esc(s.role) + ') <a href="index.html">View website</a><button id="logoutBtn">Logout</button></div></header>');
  $('#logoutBtn').onclick = function () { logout('login.html'); };
  var pt = $('#pnToggle');
  if (window.matchMedia('(max-width:760px)').matches) { pt.style.display = 'inline-block'; pt.onclick = function () { $('#pn').classList.toggle('open'); }; }
  /* idle timeout (45 minutes) */
  var bump = function () { var x = me(); if (x) { x.t = Date.now(); SS.set(x); } };
  ['click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, bump); });
  setInterval(function () { var x = me(); if (!x || Date.now() - x.t > 45 * 60000) { SS.clear(); location.href = 'login.html'; } }, 60000);
}

/* ---------- picture holders ---------- */
var FX = ['fade', 'slide-l', 'slide-r', 'slide-u', 'slide-d', 'zoom', 'zoomout', 'flip', 'rotate', 'blur', 'wipe', 'circle', 'blinds', 'skew'];
var STAGES = [];

function samples() {
  var data = [['Business Cards', '#1a4fa3', '#061a3d'], ['Banners & Flex', '#d62839', '#6b0f1a'], ['Flyers & Posters', '#0a7d8c', '#053a43'], ['ID Cards & Lamination', '#7b2cbf', '#3a0f66'], ['Quality Printing, Every Time', '#c98a00', '#6b4700']];
  return data.map(function (d, i) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + d[1] + '"/><stop offset="1" stop-color="' + d[2] + '"/></linearGradient></defs>' +
      '<rect width="1200" height="520" fill="url(#g)"/><circle cx="' + (180 + i * 160) + '" cy="90" r="230" fill="#fff" fill-opacity=".07"/><circle cx="1050" cy="460" r="200" fill="#fff" fill-opacity=".08"/>' +
      '<g fill="#00b4ff"><circle cx="560" cy="150" r="14"/></g><g fill="#ff2d9b"><circle cx="600" cy="150" r="14"/></g><g fill="#ffe600"><circle cx="640" cy="150" r="14"/></g><g fill="#111"><circle cx="680" cy="150" r="14" stroke="#fff"/></g>' +
      '<text x="600" y="270" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="64" fill="#fff">' + esc(d[0]).replace(/&amp;/g, '&amp;') + '</text>' +
      '<text x="600" y="335" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" fill="#ffe27a">SARLOD Printing Hub &#183; Gabi</text>' +
      '<text x="600" y="400" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="26" fill="#fff" fill-opacity=".85">We lead; God our leader</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function slideshow(stage, srcs) {
  if (stage._t) clearInterval(stage._t);
  stage.innerHTML = ''; var i = 0, last = '';
  var show = function (first) {
    var fx = first ? '' : FX[Math.floor(Math.random() * FX.length)];
    if (fx === last) fx = FX[(FX.indexOf(fx) + 1) % FX.length];
    last = fx;
    var img = new Image(); img.className = 'slide' + (first ? '' : ' fx-' + fx); img.alt = 'SARLOD Printing Hub'; img.src = srcs[i];
    stage.appendChild(img);
    setTimeout(function () { var all = stage.querySelectorAll('.slide'); for (var k = 0; k < all.length - 1; k++) all[k].remove(); }, 1300);
    i = (i + 1) % srcs.length;
  };
  show(true);
  if (srcs.length > 1) { stage._t = setInterval(function () { show(false); }, 4200); STAGES.push(stage); }
}

async function renderHolders(page, mount) {
  STAGES.forEach(function (s) { clearInterval(s._t); }); STAGES = [];
  var admin = isAdmin(); mount.innerHTML = '';
  if (admin) {
    var tools = document.createElement('div'); tools.className = 'holder-tools no-print';
    tools.innerHTML = '<button class="btn gold" id="mkHolder">\u2795 Create picture holder</button>';
    mount.appendChild(tools);
    $('#mkHolder', tools).onclick = function () {
      var m = modal('Create picture holder',
        '<form><label>Holder name (optional)</label><input id="hn" placeholder="e.g. Our Recent Work"><div style="height:10px"></div><label>Size</label><select id="hs"><option value="wide">Wide (full width)</option><option value="normal">Normal (side by side)</option></select><div style="height:14px"></div><button class="btn" type="submit">Create holder</button></form>');
      $('form', m.el).onsubmit = function (e) {
        e.preventDefault();
        var hs = LS.get('holders', []); hs.push({ id: uid(), page: page, title: $('#hn', m.el).value.trim(), size: $('#hs', m.el).value });
        LS.set('holders', hs); m.close(); toast('Picture holder created - now add pictures to it'); renderHolders(page, mount);
      };
    };
  }
  var hs = LS.get('holders', []).filter(function (h) { return h.page === page; });
  var sample = false;
  if (!hs.length) { sample = true; hs = [{ id: 'sample-' + page, title: page === 'gallery' ? 'Our Work' : '', size: 'wide' }]; }
  var grid = document.createElement('div'); grid.className = 'holders-grid'; mount.appendChild(grid);
  var allPics = [];
  for (var n = 0; n < hs.length; n++) {
    var h = hs[n], pics = [];
    if (!sample) { try { pics = (await Pics.byHolder(h.id)) || []; } catch (e) { pics = []; } }
    pics.sort(function (a, b) { return a.t - b.t; }); allPics = allPics.concat(pics);
    var w = document.createElement('div'); w.className = 'holder ' + (h.size === 'wide' ? 'wide' : '');
    w.innerHTML = (h.title ? '<div class="holder-title">' + esc(h.title) + '</div>' : '') + '<div class="stage"></div>' +
      (admin && sample ? '<div class="holder-note no-print">Sample slides shown. Click "Create picture holder" above, then add your own pictures.</div>' : '') +
      (admin && !sample ? '<div class="holder-admin no-print" data-h="' + h.id + '"><button class="btn sm" data-a="add">\uD83D\uDCF7 Add pictures</button><button class="btn sm ghost" data-a="manage">Manage</button><button class="btn sm danger" data-a="del">Delete holder</button></div>' : '');
    grid.appendChild(w);
    slideshow($('.stage', w), pics.length ? pics.map(function (p) { return p.data; }) : samples());
  }
  if (admin) {
    grid.addEventListener('click', async function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
      var hid = e.target.closest('.holder-admin').getAttribute('data-h');
      if (a === 'add') {
        var files = await pickFiles(true); if (!files.length) return; toast('Adding ' + files.length + ' picture(s)...');
        try { for (var k = 0; k < files.length; k++) await Pics.put({ id: uid(), holder: hid, name: files[k].name, data: await fileToData(files[k], 1400, 'image/jpeg', 0.8), t: Date.now() + k }); toast('Pictures added'); }
        catch (err) { toast('Could not save pictures (storage full?)', 'err'); }
        renderHolders(page, mount);
      }
      if (a === 'del') { if (!confirm('Delete this holder and all its pictures?')) return; await Pics.delHolder(hid); LS.set('holders', LS.get('holders', []).filter(function (x) { return x.id !== hid; })); renderHolders(page, mount); }
      if (a === 'manage') manageHolder(hid, page, mount);
    });
  }
  if (page === 'gallery') {
    var old = $('#thumbs'); if (old) old.remove();
    if (allPics.length) {
      var t = document.createElement('div'); t.id = 'thumbs'; t.className = 'thumbs';
      t.innerHTML = allPics.map(function (p) { return '<img loading="lazy" src="' + p.data + '" alt="Gallery picture">'; }).join('');
      mount.appendChild(t);
      t.onclick = function (e) { if (e.target.tagName !== 'IMG') return; var lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = '<img src="' + e.target.src + '" alt="">'; lb.onclick = function () { lb.remove(); }; document.body.appendChild(lb); };
    }
  }
}

async function manageHolder(hid, page, mount) {
  var hs = LS.get('holders', []), h = hs.filter(function (x) { return x.id === hid; })[0]; if (!h) return;
  var pics = []; try { pics = (await Pics.byHolder(hid)) || []; } catch (e) {}
  var m = modal('Manage picture holder',
    '<label>Holder name</label><input id="mn" value="' + esc(h.title) + '"><div style="height:10px"></div><label>Size</label><select id="ms"><option value="wide"' + (h.size === 'wide' ? ' selected' : '') + '>Wide</option><option value="normal"' + (h.size !== 'wide' ? ' selected' : '') + '>Normal</option></select>' +
    '<p class="lbl" style="margin-top:14px">Pictures (' + pics.length + ')</p><div class="mg">' + (pics.length ? pics.map(function (p) { return '<div><img src="' + p.data + '" alt=""><button data-p="' + p.id + '" title="Delete">&times;</button></div>'; }).join('') : '<span class="empty">No pictures yet.</span>') + '</div>' +
    '<div style="height:14px"></div><button class="btn" id="ms-save">Save changes</button>', { wide: true });
  m.el.addEventListener('click', async function (e) {
    var pid = e.target.getAttribute && e.target.getAttribute('data-p');
    if (pid) { await Pics.del(pid); e.target.parentNode.remove(); }
  });
  $('#ms-save', m.el).onclick = function () { h.title = $('#mn', m.el).value.trim(); h.size = $('#ms', m.el).value; LS.set('holders', hs); m.close(); renderHolders(page, mount); };
}

/* ---------- page logic ---------- */
var pages = {};

pages.home = function () {
  renderHolders('home', $('#holders-home'));
  $('#svcTeaser').innerHTML = getServices().slice(0, 4).map(function (s) { return '<div class="card"><div class="ico">' + esc(s.ico) + '</div><h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p></div>'; }).join('');
  var wa = $('#waBtn'); if (wa) wa.href = 'https://wa.me/' + intl(CFG.wa);
};
pages.about = function () {
  $('#aboutText').innerHTML = getAbout().split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
};
pages.services = function () {
  $('#svcList').innerHTML = getServices().map(function (s) { return '<div class="card"><div class="ico">' + esc(s.ico) + '</div><h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p><p style="margin-top:10px"><a class="btn sm" href="enquiry.html?service=' + encodeURIComponent(s.t) + '">Enquire about this</a></p></div>'; }).join('');
};
pages.gallery = function () { renderHolders('gallery', $('#holders-gallery')); };
pages.contact = function () {
  $('#waLink').href = 'https://wa.me/' + intl(CFG.wa);
  $('#mapLink').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Yabi M/A Primary School, Atwima-Yabi, Ghana');
};
pages.enquiry = function () {
  var sel = $('#service'), sv = getServices().map(function (s) { return s.t; }).concat(['Other']);
  sel.innerHTML = sv.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
  var q = new URLSearchParams(location.search).get('service'); if (q && sv.indexOf(q) > -1) sel.value = q;
  $('#enqForm').onsubmit = function (e) {
    e.preventDefault();
    var list = LS.get('enquiries', []), seq = LS.get('enqSeq', 0) + 1; LS.set('enqSeq', seq);
    var en = { id: uid(), no: 'ENQ-' + pad(seq, 4), date: todayStr(), time: nowTime(), name: $('#ename').value.trim(), phone: $('#ephone').value.trim(), email: $('#eemail').value.trim(), service: sel.value, msg: $('#emsg').value.trim(), status: 'New' };
    list.unshift(en); LS.set('enquiries', list);
    var text = 'Hello SARLOD Printing Hub, my name is ' + en.name + ' (' + en.phone + '). Service: ' + en.service + '. ' + en.msg + ' [Ref ' + en.no + ']';
    $('#enqForm').style.display = 'none';
    var r = $('#enqDone'); r.style.display = 'block';
    r.innerHTML = '<div class="msg ok"><b>Thank you, ' + esc(en.name) + '!</b> Your enquiry reference is <b>' + en.no + '</b>.</div>' +
      '<p>To make sure we receive your enquiry right away, please send it to us now:</p><div class="btns" style="justify-content:flex-start">' +
      '<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/' + intl(CFG.wa) + '?text=' + encodeURIComponent(text) + '">Send on WhatsApp</a>' +
      '<a class="btn" href="mailto:' + CFG.email + '?subject=' + encodeURIComponent('Enquiry ' + en.no + ' - ' + en.service) + '&body=' + encodeURIComponent(text) + '">Send by Email</a>' +
      '<a class="btn ghost" href="enquiry.html">New enquiry</a></div>';
  };
};
pages.login = function () {
  var s = me();
  if (s) { $('#loginCard').innerHTML = '<h3>You are signed in</h3><p>Welcome, <b>' + esc(s.name) + '</b>.</p><div class="btns" style="justify-content:flex-start"><a class="btn" href="portal.html">Open Staff Portal</a><button class="btn ghost" id="lo">Logout</button></div>'; $('#lo').onclick = function () { logout('login.html'); }; return; }
  $('#loginForm').onsubmit = function (e) {
    e.preventDefault();
    var r = login($('#lid').value, $('#lpw').value);
    if (r) { location.href = 'portal.html'; }
    else { var m = $('#lmsg'); m.className = 'msg err'; m.textContent = 'Wrong ID or password, or the account is disabled.'; $('#lpw').value = ''; }
  };
  $('#showpw').onchange = function () { $('#lpw').type = this.checked ? 'text' : 'password'; };
};

/* ---------- boot ---------- */
function requireLogin(role) {
  var s = me();
  if (!s || Date.now() - s.t > 45 * 60000) { SS.clear(); location.replace('login.html'); return false; }
  if (role === 'admin' && s.role !== 'admin') { location.replace('portal.html'); return false; }
  return true;
}
function boot() {
  initData();
  var area = document.body.getAttribute('data-area'), page = document.body.getAttribute('data-page');
  if (area === 'portal') {
    if (!requireLogin(document.body.getAttribute('data-role'))) return;
    buildPortal(page);
  } else { buildPublic(page); }
  if (pages[page]) pages[page]();
}

window.SPH = { CFG: CFG, $: $, $$: $$, esc: esc, money: money, pad: pad, todayStr: todayStr, nowTime: nowTime, uid: uid, intl: intl, LS: LS, hash: hash, me: me, isAdmin: isAdmin, login: login, logout: logout, toast: toast, modal: modal, printHTML: printHTML, csv: csv, downloadText: downloadText, getServices: getServices, getAbout: getAbout, DEFAULT_SERVICES: DEFAULT_SERVICES, DEFAULT_ABOUT: DEFAULT_ABOUT, pages: pages };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); }); else setTimeout(boot, 0);
})();
