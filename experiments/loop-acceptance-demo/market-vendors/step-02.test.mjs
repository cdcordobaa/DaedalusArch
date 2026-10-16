// Demo acceptance tests, market-vendors step 2 (fees and settlement). Pilot task only.
//
// DEMO CONTRACT (adds to step 1):
//   PUT    /fees/:size {feeCents, powerSurchargeCents}      -> 200
//   PUT    /vendors/:id/commission {rate}                   -> 200   (default rate 0.05)
//   DELETE /bookings/:id                                    -> 204 when >= 48 h before the market day; 409 after settlement
//   POST   /market-days/:id/close                           -> 200
//   POST   /market-days/:id/settlement                      -> 200 {payouts: [{vendorId, payoutCents, carriedCents}]}
//   After settlement: POST /webhooks/paylane for that day   -> 409
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

async function bookedVendor(date) {
  const day = (await call('POST', '/market-days', { date })).body.id;
  const pitch = (await call('POST', '/pitches', { number: uid(), size: 'small', power: false })).body.id;
  const vendor = (await call('POST', '/vendors', { businessName: `Farm ${uid()}`, contact: 'a@b.c', products: ['pears'] })).body.id;
  const booking = (await call('POST', '/bookings', { vendorId: vendor, pitchId: pitch, marketDayId: day })).body.id;
  const reader = `R-${uid()}`;
  await call('POST', '/reader-links', { readerId: reader, vendorId: vendor, marketDayId: day });
  return { day, pitch, vendor, booking, reader, date };
}

test('settlement pays sales minus commission minus stall fee', async () => {
  assert.equal((await call('PUT', '/fees/small', { feeCents: 1000, powerSurchargeCents: 200 })).status, 200);
  const s = await bookedVendor('2030-07-01');
  await call('POST', '/webhooks/paylane', { readerId: s.reader, amountCents: 10000, time: '2030-07-01T09:00:00Z' });
  assert.equal((await call('POST', `/market-days/${s.day}/close`)).status, 200);
  const r = await call('POST', `/market-days/${s.day}/settlement`);
  assert.equal(r.status, 200);
  const p = r.body.payouts.find((x) => x.vendorId === s.vendor);
  assert.equal(p.payoutCents, 10000 - 500 - 1000);
});

test('a payout is never negative; the debt is carried', async () => {
  await call('PUT', '/fees/small', { feeCents: 1000, powerSurchargeCents: 200 });
  const s = await bookedVendor('2030-07-02');
  await call('POST', '/webhooks/paylane', { readerId: s.reader, amountCents: 100, time: '2030-07-02T09:00:00Z' });
  await call('POST', `/market-days/${s.day}/close`);
  const p = (await call('POST', `/market-days/${s.day}/settlement`)).body.payouts.find((x) => x.vendorId === s.vendor);
  assert.equal(p.payoutCents, 0);
  assert.equal(p.carriedCents, 1000 + 5 - 100);
});

test('a settled market day takes no more sales', async () => {
  const s = await bookedVendor('2030-07-03');
  await call('POST', `/market-days/${s.day}/close`);
  await call('POST', `/market-days/${s.day}/settlement`);
  assert.equal((await call('POST', '/webhooks/paylane', { readerId: s.reader, amountCents: 300, time: '2030-07-03T11:00:00Z' })).status, 409);
});

test('a booking can be cancelled well before the market day', async () => {
  const s = await bookedVendor('2031-01-01');
  assert.equal((await call('DELETE', `/bookings/${s.booking}`)).status, 204);
});
