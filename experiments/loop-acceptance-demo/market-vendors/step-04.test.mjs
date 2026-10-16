// Demo acceptance tests, market-vendors step 4 (audit and statements). Pilot task only.
//
// DEMO CONTRACT (adds to steps 1-3):
//   Changing requests may carry the header X-Organiser-Id.
//   GET /market-days/:id/audit             -> 200 [{actor, at, entity, before, after}]
//   GET /vendors/:id/statements/:YYYY-MM   -> 200 {bookings: [...], salesByProvider: {paylane, tillwave}, feesCents, payoutsCents, carriedCents}
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL;
async function call(method, path, body, headers = {}) {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try { json = text === '' ? null : JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}
let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

test('a booking change is in the market day audit log with its actor', async () => {
  const day = (await call('POST', '/market-days', { date: '2030-09-01' })).body.id;
  const pitch = (await call('POST', '/pitches', { number: uid(), size: 'small', power: false })).body.id;
  const vendor = (await call('POST', '/vendors', { businessName: `Farm ${uid()}`, contact: 'a@b.c', products: ['honey'] })).body.id;
  await call('POST', '/bookings', { vendorId: vendor, pitchId: pitch, marketDayId: day }, { 'x-organiser-id': 'org-7' });
  const r = await call('GET', `/market-days/${day}/audit`);
  assert.equal(r.status, 200);
  const e = r.body.find((x) => x.entity === 'booking');
  assert.ok(e, 'a booking audit entry');
  assert.equal(e.actor, 'org-7');
  assert.equal(e.before, null);
  assert.ok(e.after !== null && typeof e.at === 'string');
});

test('a vendor statement lists the month', async () => {
  const day = (await call('POST', '/market-days', { date: '2030-09-08' })).body.id;
  const pitch = (await call('POST', '/pitches', { number: uid(), size: 'small', power: false })).body.id;
  const vendor = (await call('POST', '/vendors', { businessName: `Farm ${uid()}`, contact: 'a@b.c', products: ['bread'] })).body.id;
  await call('POST', '/bookings', { vendorId: vendor, pitchId: pitch, marketDayId: day });
  const reader = `R-${uid()}`;
  await call('POST', '/reader-links', { readerId: reader, vendorId: vendor, marketDayId: day });
  await call('POST', '/webhooks/paylane', { readerId: reader, amountCents: 700, time: '2030-09-08T10:00:00Z' });
  const r = await call('GET', `/vendors/${vendor}/statements/2030-09`);
  assert.equal(r.status, 200);
  assert.equal(r.body.bookings.length, 1);
  assert.equal(r.body.salesByProvider.paylane, 700);
});
