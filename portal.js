/* SARLOD Printing Hub - staff portal pages (dashboard, job log, returns, attendance, account, admin) */
(function () {
'use strict';
var S = window.SPH; if (!S) return;
var $ = S.$, $$ = S.$$, esc = S.esc, money = S.money, LS = S.LS, uid = S.uid;
var STATUSES = ['Received', 'In Progress', 'Ready', 'Delivered', 'Cancelled'];
var bcls = function (s) { return 'b-' + String(s).replace(/\s/g, ''); };
var num = function (v) { return parseFloat(v) || 0; };
var root = function () { return $('#content'); };

/* ---------- attendance helper ---------- */
function clock(kind) {
  var me = S.me(), t = S.todayStr(), list = LS.get('attendance', []);
  var rec = list.filter(function (a) { return a.sid === me.id && a.date === t; })[0];
  if (kind === 'in') {
    if (rec) { S.toast('You already signed in today at ' + rec.in); return false; }
    list.unshift({ id: uid(), sid: me.id, name: me.name, date: t, in: S.nowTime(), out: '' }); LS.set('attendance', list); S.toast('Signed in at ' + S.nowTime()); return true;
  }
  if (!rec) { S.toast('Sign in first', 'err'); return false; }
  rec.out = S.nowTime(); LS.set('attendance', list); S.toast('Signed out at ' + rec.out); return true;
}

/* ---------- dashboard ---------- */
S.pages.dash = function () {
  var me = S.me(), jobs = LS.get('jobs', []), ret = LS.get('returns', []), t = S.todayStr();
  var sum = function (a, f) { return a.reduce(function (x, y) { return x + f(y); }, 0); };
  var open = jobs.filter(function (j) { return j.status === 'Received' || j.status === 'In Progress'; }).length;
  var ready = jobs.filter(function (j) { return j.status === 'Ready'; }).length;
  var owed = sum(jobs.filter(function (j) { return j.status !== 'Cancelled'; }), function (j) { return Math.max(0, num(j.total) - num(j.paid)); });
  var inc = sum(ret.filter(function (r) { return r.date === t && r.type === 'Income'; }), function (r) { return num(r.amt); });
  var exp = sum(ret.filter(function (r) { return r.date === t && r.type === 'Expense'; }), function (r) { return num(r.amt); });
  var newEnq = LS.get('enquiries', []).filter(function (e) { return e.status === 'New'; }).length;
  var recent = jobs.slice(0, 8);
  root().innerHTML = '<div class="portal-main container">' +
    '<div class="page-head"><div><h2>Welcome, ' + esc(me.name) + '</h2><span style="color:#5b6b86">' + new Date().toDateString() + '</span></div>' +
    '<div class="btns"><button class="btn" id="goJob">+ New Job</button><button class="btn ghost" id="cIn">Sign in (attendance)</button><button class="btn ghost" id="cOut">Sign out</button></div></div>' +
    '<div class="cards stats">' +
    '<div class="stat blue"><small>Jobs today</small><b>' + jobs.filter(function (j) { return j.date === t; }).length + '</b></div>' +
    '<div class="stat"><small>Open jobs</small><b>' + open + '</b></div>' +
    '<div class="stat green"><small>Ready for collection</small><b>' + ready + '</b></div>' +
    '<div class="stat red"><small>Customer balances owing</small><b>' + money(owed) + '</b></div>' +
    '<div class="stat green"><small>Income today</small><b>' + money(inc) + '</b></div>' +
    '<div class="stat red"><small>Expenses today</small><b>' + money(exp) + '</b></div>' +
    '<div class="stat blue"><small>Net today</small><b>' + money(inc - exp) + '</b></div>' +
    (me.role === 'admin' ? '<div class="stat"><small>New enquiries</small><b>' + newEnq + '</b></div>' : '') + '</div>' +
    '<h3 style="margin-top:22px">Recent jobs</h3><div class="table-wrap">' + (recent.length ? '<table><thead><tr><th>Job No</th><th>Date</th><th>Customer</th><th>Job</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>' +
      recent.map(function (j) { return '<tr><td><b>' + esc(j.no) + '</b></td><td>' + esc(j.date) + '</td><td>' + esc(j.customer) + '</td><td>' + esc(j.desc) + '</td><td class="num">' + money(num(j.total) - num(j.paid)) + '</td><td><span class="badge ' + bcls(j.status) + '">' + esc(j.status) + '</span></td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No jobs logged yet. Click "+ New Job" to record the first one.</div>') + '</div>' +
    '<div class="cards" style="margin-top:22px"><a class="card" href="joblog.html" style="text-decoration:none"><div class="ico">&#128221;</div><h3>Job Log</h3><p>Record and track every customer job.</p></a>' +
    '<a class="card" href="returns.html" style="text-decoration:none"><div class="ico">&#128176;</div><h3>Daily Returns</h3><p>Record income and expenses for the day.</p></a>' +
    '<a class="card" href="attendance.html" style="text-decoration:none"><div class="ico">&#128338;</div><h3>Attendance</h3><p>Sign in and out of work.</p></a></div></div>';
  $('#goJob').onclick = function () { location.href = 'joblog.html?new=1'; };
  $('#cIn').onclick = function () { clock('in'); };
  $('#cOut').onclick = function () { clock('out'); };
};

/* ---------- job log ---------- */
function ticket(j) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(j.no) + '</title><style>body{font-family:Arial,sans-serif;max-width:380px;margin:10px auto;color:#000}h2{text-align:center;margin:0}p{margin:3px 0}.c{text-align:center;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:3px 0;font-size:14px}hr{border:0;border-top:1px dashed #000;margin:8px 0}.b{font-weight:bold}</style></head><body>' +
    '<h2>SARLOD PRINTING HUB</h2><p class="c">Gabi, Atwima-Yabi &middot; Opp. Yabi M/A Primary Sch<br>Tel: 0246973733 / 0243610042</p><hr>' +
    '<p class="b">JOB TICKET: ' + esc(j.no) + '</p><p>Date: ' + esc(j.date) + (j.due ? ' &nbsp; Due: ' + esc(j.due) : '') + '</p>' +
    '<p>Customer: ' + esc(j.customer) + '</p><p>Phone: ' + esc(j.phone) + '</p><hr><p>' + esc(j.desc) + '</p><table>' +
    '<tr><td>Qty</td><td style="text-align:right">' + esc(j.qty) + '</td></tr><tr><td>Total</td><td style="text-align:right">' + money(j.total) + '</td></tr>' +
    '<tr><td>Paid</td><td style="text-align:right">' + money(j.paid) + '</td></tr><tr class="b"><td>Balance</td><td style="text-align:right">' + money(num(j.total) - num(j.paid)) + '</td></tr></table><hr>' +
    '<p>Status: ' + esc(j.status) + '</p><p>Served by: ' + esc(j.staff) + '</p><p class="c"><i>We lead; God our leader</i></p></body></html>';
}

function jobForm(job, done) {
  var j = job || { date: S.todayStr(), status: 'Received', qty: 1, unit: '', total: '', paid: 0, due: '', customer: '', phone: '', desc: '', notes: '' };
  var m = S.modal(job ? 'Edit job ' + job.no : 'New job',
    '<form id="jf"><div class="fg">' +
    '<div><label>Date</label><input type="date" id="j_date" value="' + esc(j.date) + '" required></div>' +
    '<div><label>Due date</label><input type="date" id="j_due" value="' + esc(j.due || '') + '"></div>' +
    '<div><label>Customer name *</label><input id="j_cust" value="' + esc(j.customer) + '" required></div>' +
    '<div><label>Customer phone</label><input id="j_phone" type="tel" value="' + esc(j.phone) + '"></div>' +
    '<div class="full"><label>Job description *</label><textarea id="j_desc" required style="min-height:70px">' + esc(j.desc) + '</textarea></div>' +
    '<div><label>Quantity</label><input id="j_qty" type="number" min="0" step="any" value="' + esc(j.qty) + '"></div>' +
    '<div><label>Unit price (GH&cent;)</label><input id="j_unit" type="number" min="0" step="any" value="' + esc(j.unit) + '"></div>' +
    '<div><label>Total (GH&cent;) *</label><input id="j_total" type="number" min="0" step="any" value="' + esc(j.total) + '" required></div>' +
    '<div><label>Amount paid (GH&cent;)</label><input id="j_paid" type="number" min="0" step="any" value="' + esc(j.paid) + '"></div>' +
    '<div><label>Balance (GH&cent;)</label><input id="j_bal" readonly></div>' +
    '<div><label>Status</label><select id="j_status">' + STATUSES.map(function (s) { return '<option' + (s === j.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
    '<div class="full"><label>Notes</label><input id="j_notes" value="' + esc(j.notes) + '"></div></div>' +
    '<p style="margin-top:14px"><button class="btn" type="submit">Save job</button></p></form>', { wide: true });
  var el = m.el, g = function (id) { return $('#' + id, el); };
  var bal = function () { g('j_bal').value = (num(g('j_total').value) - num(g('j_paid').value)).toFixed(2); };
  var calc = function () { if (g('j_qty').value !== '' && g('j_unit').value !== '') g('j_total').value = (num(g('j_qty').value) * num(g('j_unit').value)).toFixed(2); bal(); };
  g('j_qty').oninput = calc; g('j_unit').oninput = calc; g('j_total').oninput = bal; g('j_paid').oninput = bal; bal();
  g('jf').onsubmit = function (e) {
    e.preventDefault();
    var jobs = LS.get('jobs', []);
    var data = { date: g('j_date').value, due: g('j_due').value, customer: g('j_cust').value.trim(), phone: g('j_phone').value.trim(), desc: g('j_desc').value.trim(), qty: g('j_qty').value, unit: g('j_unit').value, total: num(g('j_total').value), paid: num(g('j_paid').value), status: g('j_status').value, notes: g('j_notes').value.trim() };
    if (job) { var cur = jobs.filter(function (x) { return x.id === job.id; })[0]; Object.assign(cur, data); }
    else { var seq = LS.get('jobSeq', 0) + 1; LS.set('jobSeq', seq); jobs.unshift(Object.assign({ id: uid(), no: 'SPH-' + S.pad(seq, 4), staff: S.me().name, created: Date.now() }, data)); }
    if (LS.set('jobs', jobs)) { m.close(); S.toast('Job saved'); done(); }
  };
}

S.pages.joblog = function () {
  var admin = S.isAdmin();
  root().innerHTML = '<div class="portal-main container"><div class="page-head"><h2>Job Log</h2><div class="btns no-print"><button class="btn" id="newJob">+ New Job</button><button class="btn ghost" id="expJobs">Export CSV</button><button class="btn ghost" id="prJobs">Print</button></div></div>' +
    '<div class="filters no-print"><div><label>Search</label><input id="fq" placeholder="Job no, customer, phone, job"></div>' +
    '<div><label>Status</label><select id="fs"><option value="">All</option>' + STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
    '<div><label>From</label><input type="date" id="ff"></div><div><label>To</label><input type="date" id="ft"></div><div><button class="btn ghost" id="fc">Clear</button></div></div>' +
    '<div class="cards stats" id="jstats"></div><div style="height:14px"></div><div class="table-wrap" id="jtable"></div></div>';
  var shown = [];
  function render() {
    var q = $('#fq').value.toLowerCase(), st = $('#fs').value, f = $('#ff').value, t = $('#ft').value;
    shown = LS.get('jobs', []).filter(function (j) {
      return (!q || (j.no + ' ' + j.customer + ' ' + j.phone + ' ' + j.desc).toLowerCase().indexOf(q) > -1) && (!st || j.status === st) && (!f || j.date >= f) && (!t || j.date <= t);
    });
    var live = shown.filter(function (j) { return j.status !== 'Cancelled'; });
    var tot = live.reduce(function (a, j) { return a + num(j.total); }, 0), paid = live.reduce(function (a, j) { return a + num(j.paid); }, 0);
    $('#jstats').innerHTML = '<div class="stat blue"><small>Jobs shown</small><b>' + shown.length + '</b></div><div class="stat"><small>Total value</small><b>' + money(tot) + '</b></div><div class="stat green"><small>Paid</small><b>' + money(paid) + '</b></div><div class="stat red"><small>Outstanding</small><b>' + money(tot - paid) + '</b></div>';
    $('#jtable').innerHTML = shown.length ? '<table><thead><tr><th>Job No</th><th>Date</th><th>Customer</th><th>Job</th><th class="num">Qty</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Due</th><th>Status</th><th>Staff</th><th class="no-print"></th></tr></thead><tbody>' +
      shown.map(function (j) {
        return '<tr><td><b>' + esc(j.no) + '</b></td><td>' + esc(j.date) + '</td><td>' + esc(j.customer) + '<br><small>' + esc(j.phone) + '</small></td><td>' + esc(j.desc) + (j.notes ? '<br><small>' + esc(j.notes) + '</small>' : '') + '</td><td class="num">' + esc(j.qty) + '</td><td class="num">' + money(j.total) + '</td><td class="num">' + money(j.paid) + '</td><td class="num"><b>' + money(num(j.total) - num(j.paid)) + '</b></td><td>' + esc(j.due || '') + '</td>' +
          '<td><select data-st="' + j.id + '">' + STATUSES.map(function (s) { return '<option' + (s === j.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td><td>' + esc(j.staff) + '</td>' +
          '<td class="no-print"><div class="row-actions"><button data-e="' + j.id + '" title="Edit">&#9998;</button><button data-t="' + j.id + '" title="Print ticket">&#129534;</button>' + (admin ? '<button data-d="' + j.id + '" title="Delete">&#128465;</button>' : '') + '</div></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">No jobs match. Click "+ New Job" to record one.</div>';
  }
  ['fq', 'fs', 'ff', 'ft'].forEach(function (id) { $('#' + id).oninput = render; });
  $('#fc').onclick = function () { ['fq', 'fs', 'ff', 'ft'].forEach(function (id) { $('#' + id).value = ''; }); render(); };
  $('#newJob').onclick = function () { jobForm(null, render); };
  $('#prJobs').onclick = function () { window.print(); };
  $('#expJobs').onclick = function () {
    S.csv('sarlod-job-log-' + S.todayStr() + '.csv', [['Job No', 'Date', 'Customer', 'Phone', 'Job', 'Qty', 'Unit price', 'Total', 'Paid', 'Balance', 'Due', 'Status', 'Staff', 'Notes']].concat(shown.map(function (j) { return [j.no, j.date, j.customer, j.phone, j.desc, j.qty, j.unit, j.total, j.paid, num(j.total) - num(j.paid), j.due, j.status, j.staff, j.notes]; })));
  };
  $('#jtable').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-st'); if (!id) return;
    var jobs = LS.get('jobs', []), j = jobs.filter(function (x) { return x.id === id; })[0]; j.status = e.target.value; LS.set('jobs', jobs); S.toast(j.no + ' marked ' + j.status); render();
  });
  $('#jtable').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var jobs = LS.get('jobs', []), find = function (id) { return jobs.filter(function (x) { return x.id === id; })[0]; };
    if (b.getAttribute('data-e')) jobForm(find(b.getAttribute('data-e')), render);
    if (b.getAttribute('data-t')) S.printHTML(ticket(find(b.getAttribute('data-t'))));
    if (b.getAttribute('data-d') && confirm('Delete this job permanently?')) { LS.set('jobs', jobs.filter(function (x) { return x.id !== b.getAttribute('data-d'); })); render(); }
  });
  render();
  if (new URLSearchParams(location.search).get('new')) jobForm(null, render);
};

/* ---------- daily returns & expenses ---------- */
S.pages.returns = function () {
  var t = S.todayStr(), admin = S.isAdmin(), me = S.me();
  var cats = ['Printing', 'Photocopy / Scanning', 'Banner / Flex', 'Graphic design', 'Binding / Lamination', 'Job payment', 'Paper & materials', 'Ink / Toner', 'Electricity', 'Transport', 'Salaries', 'Rent', 'Repairs', 'Other'];
  root().innerHTML = '<div class="portal-main container"><div class="page-head"><h2>Daily Returns &amp; Expenses</h2><div class="btns no-print"><button class="btn" id="addR">+ Add entry</button><button class="btn ghost" id="expR">Export CSV</button><button class="btn ghost" id="prR">Print</button></div></div>' +
    '<div class="filters no-print"><div><label>From</label><input type="date" id="rf" value="' + t + '"></div><div><label>To</label><input type="date" id="rt" value="' + t + '"></div><div><label>Type</label><select id="rty"><option value="">All</option><option>Income</option><option>Expense</option></select></div></div>' +
    '<div class="cards stats" id="rstats"></div><div style="height:14px"></div><div class="table-wrap" id="rtable"></div></div>';
  var shown = [];
  function render() {
    var f = $('#rf').value, to = $('#rt').value, ty = $('#rty').value;
    shown = LS.get('returns', []).filter(function (r) { return (!f || r.date >= f) && (!to || r.date <= to) && (!ty || r.type === ty); });
    var inc = shown.filter(function (r) { return r.type === 'Income'; }).reduce(function (a, r) { return a + num(r.amt); }, 0);
    var exp = shown.filter(function (r) { return r.type === 'Expense'; }).reduce(function (a, r) { return a + num(r.amt); }, 0);
    $('#rstats').innerHTML = '<div class="stat green"><small>Income</small><b>' + money(inc) + '</b></div><div class="stat red"><small>Expenses</small><b>' + money(exp) + '</b></div><div class="stat blue"><small>Balance</small><b>' + money(inc - exp) + '</b></div>';
    $('#rtable').innerHTML = shown.length ? '<table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Method</th><th class="num">Amount</th><th>Staff</th><th class="no-print"></th></tr></thead><tbody>' +
      shown.map(function (r) {
        var can = admin || (r.sid === me.id && r.date === t);
        return '<tr><td>' + esc(r.date) + '</td><td><span class="badge ' + bcls(r.type) + '">' + r.type + '</span></td><td>' + esc(r.cat) + '</td><td>' + esc(r.desc) + '</td><td>' + esc(r.method) + '</td><td class="num"><b>' + money(r.amt) + '</b></td><td>' + esc(r.staff) + '</td><td class="no-print">' + (can ? '<div class="row-actions"><button data-d="' + r.id + '" title="Delete">&#128465;</button></div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">No entries for this period.</div>';
  }
  ['rf', 'rt', 'rty'].forEach(function (id) { $('#' + id).oninput = render; });
  $('#prR').onclick = function () { window.print(); };
  $('#expR').onclick = function () { S.csv('sarlod-returns-' + S.todayStr() + '.csv', [['Date', 'Type', 'Category', 'Description', 'Method', 'Amount', 'Staff']].concat(shown.map(function (r) { return [r.date, r.type, r.cat, r.desc, r.method, r.amt, r.staff]; }))); };
  $('#rtable').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !confirm('Delete this entry?')) return;
    LS.set('returns', LS.get('returns', []).filter(function (r) { return r.id !== b.getAttribute('data-d'); })); render();
  });
  $('#addR').onclick = function () {
    var m = S.modal('Add entry', '<form><div class="fg"><div><label>Date</label><input type="date" id="r_d" value="' + t + '" required></div>' +
      '<div><label>Type</label><select id="r_t"><option>Income</option><option>Expense</option></select></div>' +
      '<div><label>Category</label><input id="r_c" list="cats" required><datalist id="cats">' + cats.map(function (c) { return '<option value="' + c + '">'; }).join('') + '</datalist></div>' +
      '<div><label>Amount (GH&cent;)</label><input id="r_a" type="number" min="0.01" step="any" required></div>' +
      '<div><label>Method</label><select id="r_m"><option>Cash</option><option>Mobile Money</option><option>Bank</option></select></div>' +
      '<div class="full"><label>Description</label><input id="r_x" required></div></div><p style="margin-top:14px"><button class="btn" type="submit">Save entry</button></p></form>');
    $('form', m.el).onsubmit = function (e) {
      e.preventDefault(); var list = LS.get('returns', []);
      list.unshift({ id: uid(), date: $('#r_d', m.el).value, type: $('#r_t', m.el).value, cat: $('#r_c', m.el).value.trim(), amt: num($('#r_a', m.el).value), method: $('#r_m', m.el).value, desc: $('#r_x', m.el).value.trim(), staff: me.name, sid: me.id });
      list.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      if (LS.set('returns', list)) { m.close(); S.toast('Entry saved'); render(); }
    };
  };
  render();
};

/* ---------- attendance ---------- */
S.pages.attendance = function () {
  var me = S.me(), admin = S.isAdmin();
  root().innerHTML = '<div class="portal-main container"><div class="page-head"><h2>Attendance</h2><div class="btns no-print"><button class="btn" id="aIn">Sign in</button><button class="btn ghost" id="aOut">Sign out</button>' + (admin ? '<button class="btn ghost" id="aCsv">Export CSV</button>' : '') + '</div></div>' +
    '<p style="color:#5b6b86">' + (admin ? 'Showing attendance for all staff.' : 'Showing your attendance records.') + '</p><div class="table-wrap" id="atable"></div></div>';
  function render() {
    var list = LS.get('attendance', []).filter(function (a) { return admin || a.sid === me.id; });
    $('#atable').innerHTML = list.length ? '<table><thead><tr><th>Date</th><th>Staff</th><th>Signed in</th><th>Signed out</th></tr></thead><tbody>' + list.map(function (a) { return '<tr><td>' + esc(a.date) + '</td><td>' + esc(a.name) + '</td><td>' + esc(a.in) + '</td><td>' + esc(a.out || '-') + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No attendance records yet.</div>';
  }
  $('#aIn').onclick = function () { clock('in'); render(); };
  $('#aOut').onclick = function () { clock('out'); render(); };
  if (admin) $('#aCsv').onclick = function () { S.csv('sarlod-attendance.csv', [['Date', 'Staff', 'Signed in', 'Signed out']].concat(LS.get('attendance', []).map(function (a) { return [a.date, a.name, a.in, a.out]; }))); };
  render();
};

/* ---------- my account ---------- */
S.pages.account = function () {
  var me = S.me();
  root().innerHTML = '<div class="portal-main container"><div class="page-head"><h2>My Account</h2></div><div class="formcard"><p><b>Name:</b> ' + esc(me.name) + '<br><b>Staff ID:</b> ' + esc(me.id) + '<br><b>Role:</b> ' + esc(me.role) + '</p><h3>Change password</h3>' +
    '<form id="pwf"><label>Current password</label><input type="password" id="p0" required autocomplete="current-password"><div style="height:10px"></div><label>New password (at least 6 characters)</label><input type="password" id="p1" required minlength="6" autocomplete="new-password"><div style="height:10px"></div><label>Confirm new password</label><input type="password" id="p2" required autocomplete="new-password"><div id="pmsg"></div><p><button class="btn" type="submit">Update password</button></p></form></div></div>';
  $('#pwf').onsubmit = function (e) {
    e.preventDefault(); var m = $('#pmsg'), st = LS.get('staff', []), u = st.filter(function (x) { return x.id === me.id; })[0];
    if (u.ph !== S.hash(u.id, $('#p0').value)) { m.className = 'msg err'; m.textContent = 'Current password is wrong.'; return; }
    if ($('#p1').value !== $('#p2').value) { m.className = 'msg err'; m.textContent = 'New passwords do not match.'; return; }
    u.ph = S.hash(u.id, $('#p1').value); LS.set('staff', st); m.className = 'msg ok'; m.textContent = 'Password updated.'; $('#pwf').reset();
  };
};

/* ---------- admin panel ---------- */
S.pages.admin = function () {
  root().innerHTML = '<div class="portal-main container"><div class="page-head"><h2>Admin Panel</h2><a class="btn gold" href="index.html">Manage pictures on the website</a></div>' +
    '<div class="tabs" id="tabs"><button data-t="staff" class="on">Staff accounts</button><button data-t="enq">Customer enquiries</button><button data-t="content">Website content</button><button data-t="backup">Backup &amp; restore</button></div><div id="tab"></div></div>';
  var tabs = { staff: tStaff, enq: tEnq, content: tContent, backup: tBackup };
  $('#tabs').onclick = function (e) { var t = e.target.getAttribute('data-t'); if (!t) return; $$('#tabs button').forEach(function (b) { b.classList.toggle('on', b === e.target); }); tabs[t](); };
  tStaff();

  function tStaff() {
    var me = S.me();
    $('#tab').innerHTML = '<div class="formcard" style="max-width:none;margin-bottom:16px"><h3>Add staff / administrator</h3><form id="sf"><div class="fg"><div><label>Staff ID *</label><input id="s_id" required pattern="[A-Za-z0-9_.-]{2,20}" title="Letters, numbers, . _ - (2-20 characters)"></div><div><label>Full name *</label><input id="s_n" required></div><div><label>Role</label><select id="s_r"><option value="staff">Staff</option><option value="admin">Administrator</option></select></div><div><label>Password (min 6) *</label><input id="s_p" type="text" required minlength="6"></div></div><p style="margin-top:12px"><button class="btn" type="submit">Add account</button></p></form></div><div class="table-wrap" id="stbl"></div>';
    function list() {
      var st = LS.get('staff', []);
      $('#stbl').innerHTML = '<table><thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' + st.map(function (u) {
        return '<tr><td><b>' + esc(u.id) + '</b></td><td>' + esc(u.name) + '</td><td>' + esc(u.role) + '</td><td><span class="badge ' + (u.active ? 'b-Handled' : 'b-Cancelled') + '">' + (u.active ? 'Active' : 'Disabled') + '</span></td><td><div class="row-actions"><button data-a="pw" data-id="' + esc(u.id) + '">Reset password</button><button data-a="tg" data-id="' + esc(u.id) + '">' + (u.active ? 'Disable' : 'Enable') + '</button>' + (u.id !== me.id ? '<button data-a="rm" data-id="' + esc(u.id) + '">Delete</button>' : '') + '</div></td></tr>';
      }).join('') + '</tbody></table>';
    }
    list();
    $('#sf').onsubmit = function (e) {
      e.preventDefault(); var st = LS.get('staff', []), id = $('#s_id').value.trim();
      if (st.some(function (u) { return u.id.toLowerCase() === id.toLowerCase(); })) { S.toast('That Staff ID already exists', 'err'); return; }
      st.push({ id: id, name: $('#s_n').value.trim(), role: $('#s_r').value, active: true, ph: S.hash(id, $('#s_p').value) }); LS.set('staff', st); $('#sf').reset(); S.toast('Account added'); list();
    };
    $('#stbl').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return; var st = LS.get('staff', []), u = st.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0], a = b.getAttribute('data-a');
      var admins = st.filter(function (x) { return x.role === 'admin' && x.active; });
      if (a === 'pw') { var p = prompt('New password for ' + u.id + ' (min 6 characters):'); if (p && p.length >= 6) { u.ph = S.hash(u.id, p); LS.set('staff', st); S.toast('Password reset'); } else if (p) S.toast('Password too short', 'err'); }
      if (a === 'tg') { if (u.active && u.role === 'admin' && admins.length < 2) { S.toast('You need at least one active administrator', 'err'); return; } u.active = !u.active; LS.set('staff', st); list(); }
      if (a === 'rm') { if (u.role === 'admin' && u.active && admins.length < 2) { S.toast('You need at least one active administrator', 'err'); return; } if (confirm('Delete account ' + u.id + '?')) { LS.set('staff', st.filter(function (x) { return x !== u; })); list(); } }
    };
  }

  function tEnq() {
    function draw() {
      var en = LS.get('enquiries', []);
      $('#tab').innerHTML = '<div class="page-head"><p style="margin:0;color:#5b6b86">Enquiries saved on this device. Customers on other devices send theirs by WhatsApp or email.</p><button class="btn ghost" id="eCsv">Export CSV</button></div><div class="table-wrap">' + (en.length ? '<table><thead><tr><th>Ref</th><th>Date</th><th>Name</th><th>Contact</th><th>Service</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>' + en.map(function (x) {
        return '<tr><td><b>' + esc(x.no) + '</b></td><td>' + esc(x.date) + ' ' + esc(x.time) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.phone) + '<br><small>' + esc(x.email) + '</small></td><td>' + esc(x.service) + '</td><td>' + esc(x.msg) + '</td><td><span class="badge ' + bcls(x.status) + '">' + esc(x.status) + '</span></td><td><div class="row-actions"><a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/' + S.intl(x.phone) + '">Reply</a><button data-a="h" data-id="' + x.id + '">' + (x.status === 'New' ? 'Mark handled' : 'Reopen') + '</button><button data-a="d" data-id="' + x.id + '">Delete</button></div></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">No enquiries yet.</div>') + '</div>';
      $('#eCsv').onclick = function () { S.csv('sarlod-enquiries.csv', [['Ref', 'Date', 'Time', 'Name', 'Phone', 'Email', 'Service', 'Message', 'Status']].concat(en.map(function (x) { return [x.no, x.date, x.time, x.name, x.phone, x.email, x.service, x.msg, x.status]; }))); };
      $('#tab').onclick = function (e) {
        var b = e.target.closest('button'); if (!b || !b.getAttribute('data-a')) return; var all = LS.get('enquiries', []), x = all.filter(function (q) { return q.id === b.getAttribute('data-id'); })[0];
        if (b.getAttribute('data-a') === 'h') { x.status = x.status === 'New' ? 'Handled' : 'New'; LS.set('enquiries', all); }
        else if (confirm('Delete this enquiry?')) LS.set('enquiries', all.filter(function (q) { return q !== x; }));
        draw();
      };
    }
    draw();
  }

  function tContent() {
    var sv = S.getServices().map(function (s) { return Object.assign({}, s); });
    function draw() {
      $('#tab').innerHTML = '<div class="formcard" style="max-width:none"><h3>Services shown on the website</h3><div id="svrows"></div><p><button class="btn ghost sm" id="svAdd">+ Add service</button> <button class="btn ghost sm" id="svReset">Restore default list</button></p>' +
        '<h3 style="margin-top:20px">About Us text</h3><textarea id="abt" style="min-height:200px">' + esc(S.getAbout()) + '</textarea><p style="margin-top:14px"><button class="btn" id="cSave">Save website content</button></p></div>';
      $('#svrows').innerHTML = sv.map(function (s, i) { return '<div class="fg" style="grid-template-columns:70px 1fr 2fr auto;margin-bottom:8px;align-items:start"><input data-i="' + i + '" data-k="ico" value="' + esc(s.ico) + '"><input data-i="' + i + '" data-k="t" value="' + esc(s.t) + '"><input data-i="' + i + '" data-k="d" value="' + esc(s.d) + '"><button class="btn danger sm" data-rm="' + i + '">&times;</button></div>'; }).join('');
      $('#svrows').oninput = function (e) { var i = e.target.getAttribute('data-i'); if (i !== null) sv[i][e.target.getAttribute('data-k')] = e.target.value; };
      $('#svrows').onclick = function (e) { var r = e.target.getAttribute('data-rm'); if (r !== null) { sv.splice(+r, 1); draw(); } };
      $('#svAdd').onclick = function () { sv.push({ ico: '\u2B50', t: 'New service', d: 'Describe the service' }); draw(); };
      $('#svReset').onclick = function () { if (confirm('Replace the list with the default services?')) { sv = S.DEFAULT_SERVICES.map(function (s) { return Object.assign({}, s); }); draw(); } };
      $('#cSave').onclick = function () { LS.set('services', sv.filter(function (s) { return s.t.trim(); })); LS.set('about', $('#abt').value); S.toast('Website content saved'); };
    }
    draw();
  }

  function tBackup() {
    $('#tab').innerHTML = '<div class="formcard" style="max-width:none"><h3>Backup &amp; restore</h3><p>All job logs, returns, attendance, staff accounts, enquiries and website text are stored in this browser. <b>Download a backup regularly</b> and keep it safe. Pictures are stored separately and are not included in the backup.</p><div class="btns" style="justify-content:flex-start"><button class="btn" id="bk">Download backup</button><button class="btn ghost" id="rs">Restore from backup file</button></div></div>';
    $('#bk').onclick = function () { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('sph_') === 0) o[k] = localStorage.getItem(k); } S.downloadText('sarlod-backup-' + S.todayStr() + '.json', JSON.stringify(o)); };
    $('#rs').onclick = function () {
      var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
      i.onchange = function () {
        var fr = new FileReader(); fr.onload = function () {
          try { var o = JSON.parse(fr.result); if (!o['sph_staff']) throw new Error('bad'); if (!confirm('This replaces the current data in this browser. Continue?')) return; Object.keys(o).forEach(function (k) { if (k.indexOf('sph_') === 0) localStorage.setItem(k, o[k]); }); S.toast('Backup restored - please sign in again'); setTimeout(function () { S.logout('login.html'); }, 1200); }
          catch (e) { S.toast('That file is not a valid SARLOD backup', 'err'); }
        }; fr.readAsText(i.files[0]);
      }; i.click();
    };
  }
};
})();
