import { getStore } from '@netlify/blobs';
import { handle } from './lib/core.mjs';

export default async (req) => {
  const blobs = getStore({ name: 'sarlod-hub', consistency: 'strong' });
  const store = { get: (k) => blobs.get(k, { type: 'text' }), set: (k, v) => blobs.set(k, v) };
  try {
    return await handle(req, store);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};
