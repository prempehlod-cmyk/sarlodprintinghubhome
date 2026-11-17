// SARLOD Printing Hub - online saving logic (storage-agnostic so it can be tested)
import crypto from 'node:crypto';

const DEF_SALT = 'sarlod-default-admin';
const DEF_PASS = 'sarlod123';
const COLS = ['jobs', 'enquiries', 'reports', 'staff'];
const MAX_BODY = 5_000_000;
const MAX_ENQUIRIES = 3000;

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function defaultAdmin() {
  return { id: 'ADMIN', name: 'Administrator', role: 'admin', salt: DEF_SALT, hash: crypto.pbkdf2Sync(DEF_PASS, DEF_SALT, 100000, 32, 'sha256').toString('hex'), updated: 1 };
}
export function merge(a, b) {
  const m = new Map();
  for (const r of [...(a || []), ...(b || [])]) {
    if (!r || typeof r.id !== 'string') continue;
    const o = m.get(r.id);
    if (!o || (r.updated || 0) >= (o.updated || 0)) m.set(r.id, r);
  }
  return [...m.values()];
}
const sign = (secret, p) => crypto.createHmac('sha256', secret).update(p).digest('base64url');
function makeToken(secret, u) {
  const p = Buffer.from(JSON.stringify({ id: u.id, role: u.role, exp: Date.now() + 12 * 3600e3 })).toString('base64url');
  return p + '.' + sign(secret, p);
}
function readToken(secret, t) {
  if (!t) return null;
  const [p, sg] = t.split('.'); if (!p || !sg) return null;
  const e = sign(secret, p);
  if (e.length !== sg.length || !crypto.timingSafeEqual(Buffer.from(e), Buffer.from(sg))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.exp > Date.now() ? d : null; } catch { return null; }
}
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const clip = (v, n) => String(v ?? '').slice(0, n);

// store: { get(key) -> string|null, set(key, string) }
export async function handle(req, store) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  const jget = async k => { const t = await store.get(k); return t ? JSON.parse(t) : null; };
  const jset = (k, v) => store.set(k, JSON.stringify(v));

  let secret = await store.get('secret');
  if (!secret) { secret = crypto.randomBytes(32).toString('hex'); await store.set('secret', secret); }
  const staff = async () => { let s = await jget('c:staff'); if (!s || !s.length) { s = [defaultAdmin()]; await jset('c:staff', s); } return s; };

  let body = null;
  if (req.method === 'POST') {
    const t = await req.text();
    if (t.length > MAX_BODY) return json({ error: 'too large' }, 413);
    try { body = JSON.parse(t || '{}'); } catch { return json({ error: 'bad json' }, 400); }
  }

  /* ----- public actions ----- */
  if (action === 'ping') return json({ ok: true });
  if (action === 'salt') {
    const id = clip(url.searchParams.get('id'), 40).trim().toUpperCase();
    const u = (await staff()).find(x => x.id === id && !x.del);
    return json({ salt: u ? u.salt : sign(secret, 'salt:' + id).slice(0, 16) });
  }
  if (action === 'login' && body) {
    const id = clip(body.id, 40).trim().toUpperCase();
    const u = (await staff()).find(x => x.id === id && !x.del);
    if (!u || !same(body.hash, u.hash)) { await new Promise(r => setTimeout(r, 400)); return json({ error: 'invalid' }, 401); }
    return json({ token: makeToken(secret, u), me: u });
  }
  if (action === 'public') return json({ site: await jget('site') });
  if (action === 'img') {
    const id = clip(url.searchParams.get('id'), 40);
    if (!/^[a-z0-9]+$/.test(id)) return json({ error: 'bad id' }, 400);
    const d = await store.get('img:' + id);
    return d ? json({ data: d }) : json({ error: 'not found' }, 404);
  }
  if (action === 'enquiry' && body) {
    const name = clip(body.name, 80).trim(), phone = clip(body.phone, 20).trim(), message = clip(body.message, 1500).trim();
    if (!name || !phone || !message) return json({ error: 'missing fields' }, 400);
    const id = /^[a-z0-9]{6,30}$/.test(String(body.id)) ? body.id : crypto.randomBytes(6).toString('hex');
    const rec = { id, created: Date.now(), updated: Date.now(), name, phone, email: clip(body.email, 100), service: clip(body.service, 120), message, status: 'New', source: 'website' };
    let list = (await jget('c:enquiries')) || [];
    if (list.some(r => r.id === id)) return json({ ok: true });
    if (list.length >= MAX_ENQUIRIES) return json({ error: 'full' }, 507);
    list.push(rec); await jset('c:enquiries', list);
    return json({ ok: true });
  }

  /* ----- signed-in actions ----- */
  const a = readToken(secret, (req.headers.get('authorization') || '').replace(/^Bearer /, ''));
  const me = a && (await staff()).find(x => x.id === a.id && !x.del);
  if (!me) return json({ error: 'sign in again' }, 401);
  const admin = me.role === 'admin';

  if (action === 'passwd' && body) {
    if (!/^[0-9a-f]{16}$/.test(String(body.salt)) || !/^[0-9a-f]{64}$/.test(String(body.hash))) return json({ error: 'bad data' }, 400);
    const all = await staff();
    const i = all.findIndex(x => x.id === me.id);
    all[i] = Object.assign({}, all[i], { salt: body.salt, hash: body.hash, updated: Date.now() });
    await jset('c:staff', all);
    return json({ ok: true });
  }
  if (action === 'putimg' && body) {
    if (!admin) return json({ error: 'admin only' }, 403);
    const id = clip(body.id, 40);
    if (!/^[a-z0-9]+$/.test(id) || typeof body.data !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(body.data) || body.data.length > 3_000_000) return json({ error: 'bad image' }, 400);
    await store.set('img:' + id, body.data);
    return json({ ok: true });
  }
  if (action === 'sync' && body) {
    const out = {};
    for (const c of COLS) {
      if (c === 'staff' && !admin) continue;
      const incoming = body.cols && Array.isArray(body.cols[c]) ? body.cols[c] : [];
      const stored = (await jget('c:' + c)) || (c === 'staff' ? await staff() : []);
      let merged = merge(stored, incoming);
      if (c === 'staff') {
        merged = merged.filter(r => typeof r.id === 'string' && /^[A-Z0-9_-]{3,20}$/.test(r.id) && (r.del || (r.salt && r.hash)));
        if (!merged.some(r => r.role === 'admin' && !r.del)) merged = stored; // never lock everyone out
      }
      if (incoming.length || c === 'staff') await jset('c:' + c, merged);
      out[c] = merged;
    }
    let siteDoc = await jget('site');
    if (admin && body.site && body.site.data && (!siteDoc || (body.site.updated || 0) > (siteDoc.updated || 0))) {
      siteDoc = { updated: Number(body.site.updated) || Date.now(), data: body.site.data };
      await jset('site', siteDoc);
    }
    return json({ cols: out, site: siteDoc });
  }
  return json({ error: 'unknown action' }, 404);
}
