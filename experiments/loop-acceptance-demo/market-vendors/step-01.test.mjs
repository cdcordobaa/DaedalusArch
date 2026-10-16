// Demo acceptance tests, market-vendors step 1 (stalls). Pilot task only; not a Study 2 check.
//
// DEMO CONTRACT (all JSON; ids are strings the service returns):
//   POST /market-days {date: 'YYYY-MM-DD'}                         -> 201 {id}
//   POST /pitches {number, size: 'small'|'large', power: boolean}   -> 201 {id}
//   POST /vendors {businessName, contact, products: [string]}       -> 201 {id}
//   POST /bookings {vendorId, pitchId, marketDayId}                 -> 201 {id}; 409 pitch taken that day or vendor already holds a pitch that day
//   POST /reader-links {readerId, vendorId, marketDayId}            -> 201
//   POST /webhooks/paylane {readerId, amountCents, time: ISO}       -> 201; 422 reader not linked to a vendor with a booking that day
//   GET  /vendors/:id/sales?marketDayId=ID                          -> 200 [{amountCents, provider}]
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

async function setup(date = '2030-06-01') {
  const day = (await call('POST', '/market-days', { date })).body.id;
  const pitch = (await call('POST', '/pitches', { number: uid(), size: 'small', power: false })).body.id;
  const vendor = (await call('POST', '/vendors', { businessName: `Farm ${uid()}`, contact: 'a@b.c', products: ['apples'] })).body.id;
  return { day, pitch, vendor, date };
}

test('a vendor books a free pitch for a market day', async () => {
  const s = await setup();
  const r = await call('POST', '/bookings', { vendorId: s.vendor, pitchId: s.pitch, marketDayId: s.day });
  assert.equal(r.status, 201);
});

test('a pitch is never booked twice for the same market day', async () => {
  const s = await setup();
  const other = (await call('POST', '/vendors', { businessName: `Farm ${uid()}`, contact: 'x@y.z', products: ['eggs'] })).body.id;
  assert.equal((await call('POST', '/bookings', { vendorId: s.vendor, pitchId: s.pitch, marketDayId: s.day })).status, 201);
  assert.equal((await call('POST', '/bookings', { vendorId: other, pitchId: s.pitch, marketDayId: s.day })).status, 409);
});

test('a vendor holds at most one pitch per market day', async () => {
  const s = await setup();
  const pitch2 = (await call('POST', '/pitches', { number: uid(), size: 'large', power: true })).body.id;
  assert.equal((await call('POST', '/bookings', { vendorId: s.vendor, pitchId: s.pitch, marketDayId: s.day })).status, 201);
  assert.equal((await call('POST', '/bookings', { vendorId: s.vendor, pitchId: pitch2, marketDayId: s.day })).status, 409);
});

test('a PayLane sale from a linked reader is listed; an unlinked reader is rejected', async () => {
  const s = await setup();
  await call('POST', '/bookings', { vendorId: s.vendor, pitchId: s.pitch, marketDayId: s.day });
  const reader = `R-${uid()}`;
  assert.equal((await call('POST', '/reader-links', { readerId: reader, vendorId: s.vendor, marketDayId: s.day })).status, 201);
  assert.equal((await call('POST', '/webhooks/paylane', { readerId: reader, amountCents: 1250, time: `${s.date}T10:00:00Z` })).status, 201);
  assert.equal((await call('POST', '/webhooks/paylane', { readerId: `R-${uid()}`, amountCents: 900, time: `${s.date}T10:05:00Z` })).status, 422);
  const sales = await call('GET', `/vendors/${s.vendor}/sales?marketDayId=${s.day}`);
  assert.equal(sales.status, 200);
  assert.deepEqual(sales.body.map((x) => x.amountCents), [1250]);
});
