/* SARLOD Printing Hub - staff portal pages */
(async function () {
'use strict';
const A = window.App;
const { esc, money, today, list, put, del, Auth, Sync, KV, site, uid, now } = A;
const page = document.body.dataset.page;
const ADMIN_ONLY = ['site', 'staff'];
await A.boot('portal', { portal: true, onRefresh: () => render && render() });
const sess = Auth.require(ADMIN_ONLY.includes(page) ? 'admin' : null);
if (!sess) return;
const isAdmin = sess.role === 'admin';
let render = null;

const NAVP = [['portal.html', 'Dashboard', 'dash'], ['portal-jobs.html', 'Job Log', 'jobs'], ['portal-enquiries.html', 'Customer Enquiries', 'enq'], ['portal-reports.html', 'Duty Reports', 'rep'], ['portal-site.html', 'Site Editor', 'site', 1], ['portal-staff.html', 'Staff Accounts', 'staff', 1], ['portal-data.html', 'Data, Print & Backup', 'data']];
const TITLES = { dash: 'Dashboard', jobs: 'Job Log', enq: 'Customer Enquiries', rep: 'Duty Reports', site: 'Site Editor', staff: 'Staff Accounts', data: 'Data, Print & Backup' };
document.title = TITLES[page] + ' | Staff Portal | ' + site().company;
document.body.style.background = 'var(--bg)';
document.body.innerHTML = `<div class="portal"><aside class="side"><div class="brand-s">${esc(site().company)}</div>
${NAVP.filter(n => !n[3] || isAdmin).map(n => `<a href="${n[0]}" class="${n[2] === page ? 'on' : ''}">${n[1]}</a>`).join('')}
<div class="grow"></div><hr><a href="index.html">View website</a><a href="#" id="out">Sign out (${esc(sess.name)})</a></aside>
<main class="pmain"><div class="ptop"><h2>${TITLES[page]}</h2><span class="chip syncbar" id="sync"></span></div><div id="pbody"></div></main></div>
<div id="printArea"></div><div id="toast" style="position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:999"></div>`;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const body = $('#pbody');
$('#out').addEventListener('click', e => { e.preventDefault(); Auth.logout(); });
Sync.on(({ state, last }) => {
  const t = last ? last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const m = { synced: ['ok', '● Saved on this device and online ' + t], syncing: ['cyan', '● Saving online…'], local: ['warn', '● Saved on this device only'], offline: ['warn', '● Offline: saved on device, will upload when connected'], expired: ['bad', '● Online session ended. Sign in again to resume online saving'], error: ['bad', '● Online save failed, will retry'] }[state] || ['', state];
  const c = $('#sync'); if (c) { c.className = 'chip syncbar ' + m[0]; c.textContent = m[1]; }
});

const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const num = v => Number(v) || 0;

/* ---------- dialog form helper ---------- */
function fieldHTML(f, v) {
  const val = v[f.k] ?? f.def ?? ''; const id = 'f_' + f.k;
  let c;
  if (f.type === 'select') c = `<select id="${id}" name="${f.k}">${f.opts.map(o => `<option ${String(o) === String(val) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') c = `<textarea id="${id}" name="${f.k}" ${f.req ? 'required' : ''}>${esc(val)}</textarea>`;
  else c = `<input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(val)}" ${f.req ? 'required' : ''} ${f.type === 'number' ? 'step="0.01" min="0"' : ''} ${f.list ? `list="${f.list}"` : ''} ${f.pattern ? `pattern="${f.pattern}"` : ''} ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''}>`;
  return `<div class="${f.full ? 'full' : ''}"><label for="${id}">${f.label}</label>${c}${f.hint ? `<div class="note">${f.hint}</div>` : ''}</div>`;
}
function formDialog({ title, fields, values = {}, save, ok = 'Save', extra = '' }) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form class="dlg" novalidate="false"><h3>${esc(title)}</h3><div class="form">${fields.map(f => fieldHTML(f, values)).join('')}</div>${extra}<div class="msg err" hidden></div><div class="dlg-actions"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn mag" type="submit">${ok}</button></div></form>`;
  document.body.appendChild(d);
  const close = () => { d.close(); d.remove(); };
  $('[data-x]', d).addEventListener('click', close);
  d.addEventListener('cancel', () => setTimeout(() => d.remove(), 0));
  $('form', d).addEventListener('submit', async e => {
    e.preventDefault();
    const v = {}; fields.forEach(f => { v[f.k] = $('#f_' + f.k, d).value.trim(); });
    const r = await save(v);
    if (typeof r === 'string') { const m = $('.msg', d); m.textContent = r; m.hidden = false; return; }
    close();
  });
  d.showModal(); const first = $('input,select,textarea', d); if (first) first.focus();
  return d;
}

/* ---------- pages ---------- */
const JOBFIELDS = svcList => [
  { k: 'date', label: 'Date received', type: 'date', req: 1, def: today() },
  { k: 'no', label: 'Job number', req: 1 },
  { k: 'customer', label: 'Customer name', req: 1, full: 1 },
  { k: 'phone', label: 'Customer phone', type: 'tel' },
  { k: 'job', label: 'Job / service', req: 1, list: 'svcList' },
  { k: 'qty', label: 'Quantity', type: 'number', def: 1 },
  { k: 'amount', label: 'Amount charged (GH₵)', type: 'number', def: 0 },
  { k: 'paid', label: 'Amount paid (GH₵)', type: 'number', def: 0 },
  { k: 'due', label: 'Due / pick-up date', type: 'date' },
  { k: 'status', label: 'Status', type: 'select', opts: A.JOB_STATUS },
  { k: 'by', label: 'Handled by', def: sess.name },
  { k: 'notes', label: 'Notes', type: 'textarea', full: 1 }
];
function newJobNo() {
  const d = new Date(); const p = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const have = new Set(A.all('jobs').map(j => j.no)); let n;
  do { n = 'JOB-' + p + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(); } while (have.has(n));
  return n;
}
function jobDialog(job) {
  const svc = site().services.map(s => `<option value="${esc(s.t)}">`).join('');
  const ex = `<datalist id="svcList">${svc}</datalist>`;
  formDialog({
    title: job ? 'Edit job ' + job.no : 'New job', fields: JOBFIELDS(), values: job || { no: newJobNo(), status: 'Received' }, extra: ex,
    save: v => {
      const rec = Object.assign({}, job || { id: uid(), created: now() }, v, { qty: num(v.qty), amount: num(v.amount), paid: num(v.paid) });
      if (A.list('jobs').some(j => j.no === rec.no && j.id !== rec.id)) return 'That job number is already used.';
      put('jobs', rec); render();
    }
  });
}
const JOBCOLS = [['no', 'Job No'], ['date', 'Date'], ['customer', 'Customer'], ['phone', 'Phone'], ['job', 'Job'], ['qty', 'Qty'], ['amount', 'Amount'], ['paid', 'Paid'], ['balance', 'Balance'], ['due', 'Due'], ['status', 'Status'], ['by', 'Handled by'], ['notes', 'Notes']];
const chipFor = s => ({ Received: 'cyan', 'In progress': 'warn', Ready: 'mag', Delivered: 'ok', Cancelled: 'bad' }[s] || '');
function jobSlip(j) {
  const s = site();
  A.printHTML(`<div class="slip"><h2 style="margin:0">Job ticket</h2><div>${esc(j.no)} · ${fmtD(j.date)}</div><dl>
<dt>Customer</dt><dd>${esc(j.customer)}</dd><dt>Phone</dt><dd>${esc(j.phone)}</dd><dt>Job</dt><dd>${esc(j.job)} (qty ${esc(j.qty)})</dd>
<dt>Amount</dt><dd>${money(j.amount)}</dd><dt>Paid</dt><dd>${money(j.paid)}</dd><dt>Balance</dt><dd><b>${money(num(j.amount) - num(j.paid))}</b></dd>
<dt>Pick-up</dt><dd>${fmtD(j.due) || 'To be confirmed'}</dd><dt>Status</dt><dd>${esc(j.status)}</dd><dt>Served by</dt><dd>${esc(j.by)}</dd></dl>
<div>${esc(j.notes)}</div><p style="margin-top:14px;text-align:center"><b>${esc(s.motto)}</b></p></div>`);
}
const pages = {
  dash() {
    const jobs = list('jobs'), live = jobs.filter(j => j.status !== 'Cancelled');
    const open = jobs.filter(j => ['Received', 'In progress'].includes(j.status)).length;
    const ready = jobs.filter(j => j.status === 'Ready').length;
    const bal = live.reduce((a, j) => a + num(j.amount) - num(j.paid), 0);
    const todayN = jobs.filter(j => j.date === today()).length;
    const newEnq = list('enquiries').filter(e => e.status === 'New').length;
    const me = list('staff').find(u => u.id === sess.id);
    const warn = sess.id === 'ADMIN' && me && me.updated === 1;
    const recent = jobs.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 8);
    body.innerHTML = `${warn ? '<div class="msg err">You are still using the starting administrator password. Press <b>Change my password</b> now.</div>' : ''}
<p>Welcome, <b>${esc(sess.name)}</b> <span class="chip">${esc(sess.role)}</span></p>
<div class="stats"><div class="stat"><b>${todayN}</b><span>Jobs received today</span></div><div class="stat"><b>${open}</b><span>Open jobs</span></div><div class="stat"><b>${ready}</b><span>Ready for pick-up</span></div><div class="stat"><b>${money(bal)}</b><span>Balances owed</span></div><div class="stat"><b>${newEnq}</b><span>New enquiries</span></div></div>
<div class="row" style="margin-bottom:18px"><button class="btn mag" id="nj">+ New job</button><a class="btn ghost" href="portal-reports.html">Write duty report</a><button class="btn ghost" id="pw">Change my password</button></div>
<h3>Recently changed jobs</h3><div class="tablebox"><table><thead><tr><th>Job No</th><th>Customer</th><th>Job</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>${recent.map(j => `<tr><td>${esc(j.no)}</td><td>${esc(j.customer)}</td><td>${esc(j.job)}</td><td class="num">${money(num(j.amount) - num(j.paid))}</td><td><span class="chip ${chipFor(j.status)}">${esc(j.status)}</span></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No jobs yet. Press “New job” to record the first one.</td></tr>'}</tbody></table></div>`;
    $('#nj').onclick = () => jobDialog();
    $('#pw').onclick = passwordDialog;
  },
  jobs() {
    body.innerHTML = `<div class="toolbar"><div><label for="q">Search</label><input id="q" type="search" placeholder="Name, phone, job no…"></div>
<div><label for="st">Status</label><select id="st"><option value="">All</option>${A.JOB_STATUS.map(s => `<option>${s}</option>`).join('')}</select></div>
<div><label for="from">From</label><input id="from" type="date"></div><div><label for="to">To</label><input id="to" type="date"></div>
<div class="btns"><button class="btn mag" id="nj">+ New job</button><button class="btn ghost" id="pr">Print list</button><button class="btn ghost" id="ex">Export CSV</button></div></div>
<div class="row" id="sum" style="margin-bottom:12px"></div><div class="tablebox"><table><thead><tr><th>Job No</th><th>Date</th><th>Customer</th><th>Job</th><th class="num">Amount</th><th class="num">Balance</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody id="jb"></tbody></table></div>`;
    const rows = () => {
      const q = $('#q').value.toLowerCase(), st = $('#st').value, f = $('#from').value, t = $('#to').value;
      return list('jobs').filter(j => (!st || j.status === st) && (!f || j.date >= f) && (!t || j.date <= t) && (!q || [j.no, j.customer, j.phone, j.job, j.by, j.notes].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updated || 0) - (a.updated || 0));
    };
    const draw = () => {
      const r = rows(), live = r.filter(j => j.status !== 'Cancelled');
      const tot = live.reduce((a, j) => a + num(j.amount), 0), paid = live.reduce((a, j) => a + num(j.paid), 0);
      $('#sum').innerHTML = `<span class="chip">${r.length} jobs</span><span class="chip cyan">Charged ${money(tot)}</span><span class="chip ok">Paid ${money(paid)}</span><span class="chip warn">Balance ${money(tot - paid)}</span>`;
      $('#jb').innerHTML = r.map(j => `<tr data-id="${j.id}"><td><b>${esc(j.no)}</b></td><td>${fmtD(j.date)}</td><td>${esc(j.customer)}<div class="note">${esc(j.phone)}</div></td><td>${esc(j.job)}<div class="note">Qty ${esc(j.qty)} · ${esc(j.by)}</div></td><td class="num">${money(j.amount)}</td><td class="num">${money(num(j.amount) - num(j.paid))}</td><td>${fmtD(j.due)}</td>
<td><select data-act="st" aria-label="Status of ${esc(j.no)}">${A.JOB_STATUS.map(s => `<option ${s === j.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
<td><div class="row"><button class="btn sm ghost" data-act="edit">Edit</button><button class="btn sm ghost" data-act="slip">Ticket</button>${isAdmin ? '<button class="btn sm danger" data-act="del">Delete</button>' : ''}</div></td></tr>`).join('') || '<tr><td colspan="9" class="empty">No jobs match. Press “New job” to add one.</td></tr>';
    };
    render = draw; draw();
    ['q', 'st', 'from', 'to'].forEach(id => $('#' + id).addEventListener('input', draw));
    $('#nj').onclick = () => jobDialog();
    $('#jb').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
      const j = list('jobs').find(x => x.id === b.closest('tr').dataset.id); if (!j) return;
      if (b.dataset.act === 'edit') jobDialog(j);
      else if (b.dataset.act === 'slip') jobSlip(j);
      else if (b.dataset.act === 'del' && confirm('Delete job ' + j.no + '? This cannot be undone.')) { del('jobs', j.id); draw(); }
    });
    $('#jb').addEventListener('change', e => {
      if (e.target.dataset.act !== 'st') return;
      const j = list('jobs').find(x => x.id === e.target.closest('tr').dataset.id); if (!j) return;
      put('jobs', Object.assign({}, j, { status: e.target.value })); draw();
    });
    $('#ex').onclick = () => exportJobs(rows());
    $('#pr').onclick = () => printJobs(rows());
  },
  enq() {
    const ST = ['New', 'Contacted', 'Quoted', 'Converted', 'Closed'];
    body.innerHTML = `<p class="note">Enquiries sent from the website’s “Customers Enquiry” page appear here after the device is online and you are signed in.</p><div class="toolbar"><div><label for="eq">Search</label><input id="eq" type="search"></div><div><label for="es">Status</label><select id="es"><option value="">All</option>${ST.map(s => `<option>${s}</option>`).join('')}</select></div><div class="btns"><button class="btn ghost" id="pr">Print list</button></div></div><div class="tablebox"><table><thead><tr><th>Received</th><th>Customer</th><th>Service &amp; message</th><th>Status</th><th></th></tr></thead><tbody id="eb"></tbody></table></div>`;
    const rows = () => { const q = $('#eq').value.toLowerCase(), s = $('#es').value; return list('enquiries').filter(e => (!s || e.status === s) && (!q || [e.name, e.phone, e.email, e.service, e.message].join(' ').toLowerCase().includes(q))).sort((a, b) => (b.created || 0) - (a.created || 0)); };
    const draw = () => {
      $('#eb').innerHTML = rows().map(e => `<tr data-id="${e.id}"><td>${new Date(e.created || 0).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td><td><b>${esc(e.name)}</b><div class="note">${esc(e.phone)} ${esc(e.email)}</div></td><td><b>${esc(e.service)}</b><div style="white-space:pre-line;max-width:46ch">${esc(e.message)}</div></td>
<td><select data-act="st">${ST.map(s => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
<td><div class="row">${e.phone ? `<a class="btn sm ghost" href="https://wa.me/${A.wa(e.phone)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn sm ghost" href="tel:${esc(e.phone)}">Call</a>` : ''}<button class="btn sm" data-act="job">Make job</button>${isAdmin ? '<button class="btn sm danger" data-act="del">Delete</button>' : ''}</div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No enquiries yet.</td></tr>';
    };
    render = draw; draw();
    $('#eq').oninput = draw; $('#es').onchange = draw;
    $('#eb').addEventListener('change', e => { if (e.target.dataset.act !== 'st') return; const r = list('enquiries').find(x => x.id === e.target.closest('tr').dataset.id); put('enquiries', Object.assign({}, r, { status: e.target.value })); });
    $('#eb').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const r = list('enquiries').find(x => x.id === b.closest('tr').dataset.id); if (!r) return;
      if (b.dataset.act === 'del' && confirm('Delete this enquiry?')) { del('enquiries', r.id); draw(); }
      if (b.dataset.act === 'job') {
        put('jobs', { id: uid(), created: now(), no: newJobNo(), date: today(), customer: r.name, phone: r.phone, job: r.service, qty: 1, amount: 0, paid: 0, due: '', status: 'Received', by: sess.name, notes: r.message });
        put('enquiries', Object.assign({}, r, { status: 'Converted' })); draw(); A.toast('Job created in the Job Log');
      }
    });
    $('#pr').onclick = () => A.printHTML(`<h2>Customer enquiries</h2><table><thead><tr><th>Date</th><th>Customer</th><th>Contact</th><th>Service</th><th>Message</th><th>Status</th></tr></thead><tbody>${rows().map(e => `<tr><td>${new Date(e.created || 0).toLocaleDateString('en-GB')}</td><td>${esc(e.name)}</td><td>${esc(e.phone)} ${esc(e.email)}</td><td>${esc(e.service)}</td><td>${esc(e.message)}</td><td>${esc(e.status)}</td></tr>`).join('')}</tbody></table>`);
  },
  rep() {
    const F = [{ k: 'date', label: 'Date', type: 'date', req: 1, def: today() }, { k: 'staff', label: 'Staff name', req: 1, def: sess.name }, { k: 'work', label: 'Work done today', type: 'textarea', req: 1, full: 1 }, { k: 'jobs', label: 'Jobs completed', type: 'number', def: 0 }, { k: 'cash', label: 'Cash handed in (GH₵)', type: 'number', def: 0 }, { k: 'issues', label: 'Problems / machine faults', type: 'textarea', full: 1 }, { k: 'needs', label: 'Paper, ink or materials needed', type: 'textarea', full: 1 }];
    body.innerHTML = `<div class="toolbar"><div class="btns"><button class="btn mag" id="nr">+ New report</button><button class="btn ghost" id="pr">Print list</button></div></div><div class="tablebox"><table><thead><tr><th>Date</th><th>Staff</th><th>Work done</th><th class="num">Jobs</th><th class="num">Cash</th><th>Problems / needs</th><th></th></tr></thead><tbody id="rb"></tbody></table></div>`;
    const rows = () => list('reports').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updated || 0) - (a.updated || 0));
    const draw = () => { $('#rb').innerHTML = rows().map(r => `<tr data-id="${r.id}"><td>${fmtD(r.date)}</td><td>${esc(r.staff)}</td><td style="white-space:pre-line;max-width:40ch">${esc(r.work)}</td><td class="num">${esc(r.jobs)}</td><td class="num">${money(r.cash)}</td><td style="white-space:pre-line;max-width:36ch">${esc(r.issues)}${r.needs ? '<div class="note">Needs: ' + esc(r.needs) + '</div>' : ''}</td><td><div class="row"><button class="btn sm ghost" data-act="edit">Edit</button>${isAdmin ? '<button class="btn sm danger" data-act="del">Delete</button>' : ''}</div></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No reports yet.</td></tr>'; };
    const open = r => formDialog({ title: r ? 'Edit duty report' : 'New duty report', fields: F, values: r || {}, save: v => { put('reports', Object.assign({}, r || { id: uid(), created: now(), by: sess.id }, v, { jobs: num(v.jobs), cash: num(v.cash) })); draw(); } });
    render = draw; draw();
    $('#nr').onclick = () => open();
    $('#rb').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (!b) return; const r = list('reports').find(x => x.id === b.closest('tr').dataset.id); if (b.dataset.act === 'edit') open(r); else if (confirm('Delete this report?')) { del('reports', r.id); draw(); } });
    $('#pr').onclick = () => A.printHTML(`<h2>Duty reports</h2><table><thead><tr><th>Date</th><th>Staff</th><th>Work done</th><th>Jobs</th><th>Cash</th><th>Problems / needs</th></tr></thead><tbody>${rows().map(r => `<tr><td>${fmtD(r.date)}</td><td>${esc(r.staff)}</td><td>${esc(r.work)}</td><td>${esc(r.jobs)}</td><td>${money(r.cash)}</td><td>${esc(r.issues)} ${esc(r.needs)}</td></tr>`).join('')}</tbody></table>`);
  },
  site() {
    const MAXW = 'width:100%';
    const holderCard = h => `<div class="card" data-h="${h.id}"><div class="form"><div><label>Holder title</label><input data-hf="title" value="${esc(h.title)}"></div><div><label>Shown on</label><select data-hf="page"><option value="home" ${h.page === 'home' ? 'selected' : ''}>Home page</option><option value="gallery" ${h.page === 'gallery' ? 'selected' : ''}>Gallery page</option></select></div><div><label>Shape</label><select data-hf="size"><option value="wide" ${h.size === 'wide' ? 'selected' : ''}>Wide</option><option value="square" ${h.size === 'square' ? 'selected' : ''}>Square</option><option value="tall" ${h.size === 'tall' ? 'selected' : ''}>Tall</option></select></div><div><label>Add pictures</label><input type="file" accept="image/*" multiple data-hup></div></div>
<div class="thumbs ed" style="margin-top:12px">${(h.images || []).map(i => A.imgSrc(i) ? `<div class="t"><img src="${A.imgSrc(i)}" alt=""><button type="button" data-hrm="${i}" aria-label="Remove picture">×</button></div>` : '').join('')}</div>
<div class="row" style="margin-top:12px"><span class="note">${(h.images || []).length} picture(s). With no pictures the holder shows sample slides.</span><button type="button" class="btn sm danger" data-hdel>Remove holder</button></div></div>`;
    function draw() {
      const s = site();
      body.innerHTML = `<div id="saved" class="chip ok" style="margin-bottom:12px" hidden>Saved</div>
<div class="pgrid"><section class="card"><h3>Business details</h3><div class="form">
${[['company', 'Company name'], ['place', 'Town / place'], ['motto', 'Motto (scrolls on the home page)'], ['phone1', 'Phone 1'], ['phone2', 'Phone 2'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['hours', 'Opening hours note']].map(([k, l]) => `<div class="${k === 'motto' || k === 'hours' ? 'full' : ''}"><label>${l}</label><input data-sf="${k}" value="${esc(s[k])}"></div>`).join('')}
<div class="full"><label>Address</label><input data-sf="address" value="${esc(s.address)}"></div><div class="full"><label>About us text</label><textarea data-sf="about" style="min-height:190px">${esc(s.about)}</textarea></div></div></section>
<section class="card"><h3>Logo</h3><p class="note">The animated SARLOD logo is used unless you upload your own.</p><div class="row"><div style="width:120px;height:120px;background:var(--ink);border-radius:14px;display:grid;place-items:center;padding:6px">${s.logo && A.imgSrc(s.logo) ? `<img src="${A.imgSrc(s.logo)}" style="max-width:100%;max-height:100%" alt="">` : '<span style="color:#fff;font-weight:800">Default</span>'}</div><div><input type="file" id="logoUp" accept="image/*"><div class="row" style="margin-top:10px"><button class="btn sm ghost" id="logoReset">Use default logo</button></div></div></div>
<h3 style="margin-top:22px">Header pictures</h3><p class="note">Pictures shown behind the company name at the top of every page. They fade between each other.</p><input type="file" id="hdrUp" accept="image/*" multiple><div class="thumbs ed" style="margin-top:12px">${(s.headerImages || []).map(i => A.imgSrc(i) ? `<div class="t"><img src="${A.imgSrc(i)}" alt=""><button type="button" data-hdrrm="${i}" aria-label="Remove header picture">×</button></div>` : '').join('')}</div></section></div>
<h3 style="margin-top:26px">Picture holders</h3><p class="note">A picture holder is a frame that slides its pictures with random effects, continuously. Add holders to the home page or the gallery.</p>
<div class="pgrid" id="holders">${s.holders.map(holderCard).join('')}</div><div class="row" style="margin-top:14px"><button class="btn mag" id="addH">+ Add picture holder</button></div>
<h3 style="margin-top:26px">Services</h3><section class="card"><div id="svcs">${s.services.map((v, i) => `<div class="svc-row"><input data-svt value="${esc(v.t)}" aria-label="Service title"><input data-svd value="${esc(v.d)}" aria-label="Service description"><button class="btn sm danger" type="button" data-svx>Remove</button></div>`).join('')}</div><button class="btn sm ghost" id="addS">+ Add service</button></section>`;
      wire();
    }
    let tmr;
    const flash = () => { const e = $('#saved'); if (!e) return; e.hidden = false; clearTimeout(tmr); tmr = setTimeout(() => { e.hidden = true; }, 1500); };
    const saveSite = p => { A.setSite(p); flash(); };
    const saveHolders = (fn, redraw = true) => { const hs = site().holders.map(h => Object.assign({}, h)); fn(hs); saveSite({ holders: hs }); if (redraw) draw(); };
    async function uploadMany(files, then) {
      const ids = []; for (const f of files) { try { ids.push(await A.addImage(f)); } catch (e) { A.toast('Could not read ' + f.name, 'err'); } }
      if (ids.length) then(ids);
    }
    function wire() {
      $$('[data-sf]').forEach(i => i.addEventListener('input', () => { clearTimeout(i._t); i._t = setTimeout(() => saveSite({ [i.dataset.sf]: i.value }), 350); }));
      $('#logoUp').onchange = e => { const f = e.target.files[0]; if (f) A.addImage(f, { max: 600, alpha: true }).then(id => { saveSite({ logo: id }); draw(); }); };
      $('#logoReset').onclick = () => { saveSite({ logo: null }); draw(); };
      $('#hdrUp').onchange = e => uploadMany([...e.target.files], ids => { saveSite({ headerImages: (site().headerImages || []).concat(ids) }); draw(); });
      $$('[data-hdrrm]').forEach(b => b.onclick = () => { saveSite({ headerImages: site().headerImages.filter(i => i !== b.dataset.hdrrm) }); draw(); });
      $('#addH').onclick = () => saveHolders(hs => hs.push({ id: 'h' + uid(), page: 'home', title: 'New picture holder', size: 'wide', images: [] }));
      $$('[data-h]').forEach(card => {
        const id = card.dataset.h;
        $$('[data-hf]', card).forEach(i => i.addEventListener('change', () => saveHolders(hs => { hs.find(h => h.id === id)[i.dataset.hf] = i.value; }, false)));
        $('[data-hup]', card).onchange = e => uploadMany([...e.target.files], ids => saveHolders(hs => { const h = hs.find(x => x.id === id); h.images = (h.images || []).concat(ids); }));
        $$('[data-hrm]', card).forEach(b => b.onclick = () => saveHolders(hs => { const h = hs.find(x => x.id === id); h.images = h.images.filter(i => i !== b.dataset.hrm); }));
        $('[data-hdel]', card).onclick = () => { if (confirm('Remove this picture holder?')) saveHolders(hs => { hs.splice(hs.findIndex(h => h.id === id), 1); }); };
      });
      const readS = () => $$('.svc-row').map(r => ({ t: $('[data-svt]', r).value, d: $('[data-svd]', r).value })).filter(x => x.t.trim());
      $('#svcs').addEventListener('input', () => { clearTimeout(tmr._s); tmr._s = setTimeout(() => saveSite({ services: readS() }), 350); });
      $('#svcs').addEventListener('click', e => { if (e.target.matches('[data-svx]')) { e.target.closest('.svc-row').remove(); saveSite({ services: readS() }); } });
      $('#addS').onclick = () => { $('#svcs').insertAdjacentHTML('beforeend', '<div class="svc-row"><input data-svt aria-label="Service title" placeholder="Service title"><input data-svd aria-label="Service description" placeholder="Short description"><button class="btn sm danger" type="button" data-svx>Remove</button></div>'); $('#svcs .svc-row:last-child input').focus(); };
    }
    render = null; draw();
  },
  staff() {
    body.innerHTML = `<p class="note">Staff sign in on the Staff page with their ID and password. New accounts reach other devices after the next online save.</p><div class="toolbar"><div class="btns"><button class="btn mag" id="ns">+ New staff</button></div></div><div class="tablebox"><table><thead><tr><th>ID</th><th>Name</th><th>Role</th><th></th></tr></thead><tbody id="sb"></tbody></table></div>`;
    const draw = () => { $('#sb').innerHTML = list('staff').sort((a, b) => a.id.localeCompare(b.id)).map(u => `<tr data-id="${esc(u.id)}"><td><b>${esc(u.id)}</b></td><td>${esc(u.name)}</td><td><span class="chip ${u.role === 'admin' ? 'mag' : ''}">${esc(u.role)}</span></td><td><div class="row"><button class="btn sm ghost" data-act="pw">Reset password</button>${u.id !== sess.id ? '<button class="btn sm danger" data-act="del">Delete</button>' : ''}</div></td></tr>`).join(''); };
    render = draw; draw();
    async function setPw(u, pw) { const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join(''); return Object.assign({}, u, { salt, hash: await Auth.hash(pw, salt) }); }
    $('#ns').onclick = () => formDialog({
      title: 'New staff account', ok: 'Create', fields: [{ k: 'id', label: 'Staff ID', req: 1, pattern: '[A-Za-z0-9_\\-]{3,20}', hint: 'Letters and numbers, 3 to 20 characters.' }, { k: 'name', label: 'Full name', req: 1 }, { k: 'role', label: 'Role', type: 'select', opts: ['staff', 'admin'] }, { k: 'pw', label: 'Password', type: 'password', req: 1, hint: 'At least 6 characters.', autocomplete: 'new-password' }],
      save: async v => {
        const id = v.id.toUpperCase();
        if (!/^[A-Z0-9_-]{3,20}$/.test(id)) return 'The ID must be 3 to 20 letters or numbers.';
        if (A.all('staff').some(u => u.id === id && !u.del)) return 'That ID is already taken.';
        if (v.pw.length < 6) return 'The password needs at least 6 characters.';
        put('staff', await setPw({ id, name: v.name, role: v.role }, v.pw)); draw();
      }
    });
    $('#sb').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const u = list('staff').find(x => x.id === b.closest('tr').dataset.id);
      if (b.dataset.act === 'del') {
        if (list('staff').filter(x => x.role === 'admin').length < 2 && u.role === 'admin') { A.toast('Keep at least one administrator.', 'err'); return; }
        if (confirm('Delete ' + u.name + '?')) { del('staff', u.id); draw(); }
      } else formDialog({ title: 'New password for ' + u.name, ok: 'Set password', fields: [{ k: 'pw', label: 'New password', type: 'password', req: 1, autocomplete: 'new-password' }], save: async v => { if (v.pw.length < 6) return 'At least 6 characters.'; put('staff', await setPw(u, v.pw)); A.toast('Password changed'); } });
    });
  },
  data() {
    const cols = {
      jobs: JOBCOLS, enquiries: [['created', 'Created'], ['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['service', 'Service'], ['message', 'Message'], ['status', 'Status']],
      reports: [['date', 'Date'], ['staff', 'Staff'], ['work', 'Work done'], ['jobs', 'Jobs'], ['cash', 'Cash'], ['issues', 'Issues'], ['needs', 'Needs']]
    };
    body.innerHTML = `<div class="pgrid">
<section class="card"><h3>Saving</h3><p>Every change is saved on this device straight away and uploaded when you are online and signed in with the website’s online service.</p><div class="row"><button class="btn mag" id="sn">Save online now</button><span id="ss" class="chip"></span></div></section>
<section class="card"><h3>Print</h3><div class="row"><button class="btn ghost" id="pj">Job log</button><button class="btn ghost" id="pe">Enquiries</button><button class="btn ghost" id="prp">Duty reports</button></div></section>
<section class="card"><h3>Export</h3><div class="row"><button class="btn ghost" data-csv="jobs">Jobs (CSV)</button><button class="btn ghost" data-csv="enquiries">Enquiries (CSV)</button><button class="btn ghost" data-csv="reports">Reports (CSV)</button>${isAdmin ? '<button class="btn" id="bk">Full backup (JSON)</button>' : ''}</div></section>
${isAdmin ? `<section class="card"><h3>Import</h3><p class="note">Choose a full backup (.json) made here, or a CSV file of jobs or reports.</p><div class="form"><div><label for="impT">CSV is for</label><select id="impT"><option value="jobs">Job log</option><option value="reports">Duty reports</option></select></div><div><label for="impF">File</label><input id="impF" type="file" accept=".json,.csv"></div></div><div id="impM"></div></section>` : ''}</div>`;
    Sync.on(({ state, last }) => { const e = $('#ss'); if (e) e.textContent = state === 'synced' ? 'Last saved online ' + (last ? last.toLocaleTimeString() : '') : state; });
    $('#sn').onclick = () => Sync.run();
    $('#pj').onclick = () => printJobs(list('jobs').sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    $('#pe').onclick = () => A.printHTML(`<h2>Customer enquiries</h2><table><thead><tr><th>Name</th><th>Phone</th><th>Service</th><th>Message</th><th>Status</th></tr></thead><tbody>${list('enquiries').map(e => `<tr><td>${esc(e.name)}</td><td>${esc(e.phone)}</td><td>${esc(e.service)}</td><td>${esc(e.message)}</td><td>${esc(e.status)}</td></tr>`).join('')}</tbody></table>`);
    $('#prp').onclick = () => A.printHTML(`<h2>Duty reports</h2><table><thead><tr><th>Date</th><th>Staff</th><th>Work done</th><th>Jobs</th><th>Cash</th></tr></thead><tbody>${list('reports').map(r => `<tr><td>${fmtD(r.date)}</td><td>${esc(r.staff)}</td><td>${esc(r.work)}</td><td>${esc(r.jobs)}</td><td>${money(r.cash)}</td></tr>`).join('')}</tbody></table>`);
    $$('[data-csv]').forEach(b => b.onclick = () => {
      const c = b.dataset.csv; let rows = list(c);
      if (c === 'jobs') rows = rows.map(j => Object.assign({}, j, { balance: num(j.amount) - num(j.paid) }));
      A.saveFile('sarlod-' + c + '-' + today() + '.csv', '﻿' + A.toCSV(rows, cols[c]), 'text/csv');
    });
    if (!isAdmin) return;
    $('#bk').onclick = () => {
      const images = {}; Object.keys(KV.mem).filter(k => k.startsWith('img:')).forEach(k => { images[k.slice(4)] = KV.mem[k]; });
      const out = { format: 'sph-backup', version: 1, exported: new Date().toISOString(), site: KV.get('site') || null, cols: {}, images };
      A.COLS.forEach(c => { out.cols[c] = A.all(c); });
      A.saveFile('sarlod-backup-' + today() + '.json', JSON.stringify(out), 'application/json');
    };
    $('#impF').onchange = async e => {
      const f = e.target.files[0]; if (!f) return; const msg = $('#impM'); const text = await f.text();
      try {
        if (/\.json$/i.test(f.name)) {
          const d = JSON.parse(text); if (d.format !== 'sph-backup') throw new Error('This is not a SARLOD backup file.');
          let n = 0; for (const c of A.COLS) if (d.cols && d.cols[c]) { n += d.cols[c].length; KV.set('c:' + c, A.merge(A.all(c), d.cols[c])); }
          for (const id in (d.images || {})) KV.set('img:' + id, d.images[id]);
          KV.set('imgq', (KV.get('imgq') || []).concat(Object.keys(d.images || {})));
          if (d.site && (!KV.get('site') || d.site.updated > KV.get('site').updated)) KV.set('site', d.site);
          Sync.schedule(300); msg.innerHTML = `<div class="msg ok">Backup imported: ${n} records merged with what is already here.</div>`;
        } else {
          const t = $('#impT').value; const rows = A.parseCSV(text.replace(/^﻿/, '')); const head = rows.shift().map(h => h.trim().toLowerCase());
          const map = head.map(h => { const c = cols[t].find(x => x[1].toLowerCase() === h || x[0].toLowerCase() === h); return c ? c[0] : null; });
          if (!map.some(Boolean)) throw new Error('The first row must contain column names such as ' + cols[t].slice(0, 3).map(c => c[1]).join(', ') + '.');
          let n = 0; const arr = A.all(t).slice();
          rows.forEach(r => { const rec = { id: uid() }; map.forEach((k, i) => { if (k && k !== 'balance') rec[k] = r[i]; }); ['qty', 'amount', 'paid', 'jobs', 'cash'].forEach(k => { if (k in rec) rec[k] = num(rec[k]); }); if (t === 'jobs') { rec.no = rec.no || newJobNo(); rec.status = A.JOB_STATUS.includes(rec.status) ? rec.status : 'Received'; rec.date = rec.date || today(); } rec.updated = now(); arr.push(rec); n++; });
          KV.set('c:' + t, arr); Sync.schedule(300); msg.innerHTML = `<div class="msg ok">${n} rows imported.</div>`;
        }
      } catch (err) { msg.innerHTML = `<div class="msg err">${esc(err.message)}</div>`; }
      e.target.value = '';
    };
  }
};
function exportJobs(rows) { A.saveFile('sarlod-jobs-' + today() + '.csv', '﻿' + A.toCSV(rows.map(j => Object.assign({}, j, { balance: num(j.amount) - num(j.paid) })), JOBCOLS), 'text/csv'); }
function printJobs(rows) {
  const live = rows.filter(j => j.status !== 'Cancelled'); const tot = live.reduce((a, j) => a + num(j.amount), 0), paid = live.reduce((a, j) => a + num(j.paid), 0);
  A.printHTML(`<h2>Job log</h2><table><thead><tr><th>Job No</th><th>Date</th><th>Customer</th><th>Job</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows.map(j => `<tr><td>${esc(j.no)}</td><td>${fmtD(j.date)}</td><td>${esc(j.customer)} ${esc(j.phone)}</td><td>${esc(j.job)}</td><td>${money(j.amount)}</td><td>${money(j.paid)}</td><td>${money(num(j.amount) - num(j.paid))}</td><td>${esc(j.status)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="4">Totals (cancelled jobs left out)</th><th>${money(tot)}</th><th>${money(paid)}</th><th>${money(tot - paid)}</th><th></th></tr></tfoot></table>`);
}
async function passwordDialog() {
  formDialog({
    title: 'Change my password', ok: 'Change password',
    fields: [{ k: 'cur', label: 'Current password', type: 'password', req: 1, autocomplete: 'current-password' }, { k: 'n1', label: 'New password', type: 'password', req: 1, autocomplete: 'new-password', hint: 'At least 6 characters.' }, { k: 'n2', label: 'New password again', type: 'password', req: 1, autocomplete: 'new-password' }],
    save: async v => {
      const u = list('staff').find(x => x.id === sess.id) || KV.get('cred:' + sess.id);
      if (!u || (await Auth.hash(v.cur, u.salt)) !== u.hash) return 'Your current password is not correct.';
      if (v.n1.length < 6) return 'The new password needs at least 6 characters.';
      if (v.n1 !== v.n2) return 'The two new passwords do not match.';
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
      const hash = await Auth.hash(v.n1, salt);
      if (sess.token) { try { await Sync.call('passwd', { salt, hash }, sess.token); } catch (e) { return 'Could not reach the online service. Connect to the internet and try again.'; } }
      const rec = Object.assign({}, u, { salt, hash });
      if (list('staff').some(x => x.id === sess.id)) put('staff', rec);
      KV.set('cred:' + sess.id, rec); A.toast('Password changed'); render && render();
    }
  });
}
(pages[page] || pages.dash)();
if (page === 'dash') render = pages.dash;
})();
