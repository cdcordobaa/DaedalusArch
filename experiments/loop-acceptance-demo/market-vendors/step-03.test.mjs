// Demo acceptance tests, market-vendors step 3 (second provider, TillWave). Pilot task only.
//
// DEMO CONTRACT (adds to steps 1-2):
//   PUT  /config/tillwave {baseUrl}                       -> 200; the service polls GET <baseUrl>/sales -> [{saleId, merchantId, amountCents, time}]
//   POST /tillwave-links {merchantId, vendorId, marketDayId} -> 201
//   POST /tillwave/poll                                   -> 200 (one poll now; the 15-minute timer does the same)
//   GET  /vendors/:id/sales?marketDayId=ID                -> includes {amountCents, provider: 'tillwave'}
import { createServer } from 'node:http';
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

function fakeTillWave(sales) {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url.startsWith('/sales') ? sales : []));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

test('TillWave sales are polled, converted and counted once', async () => {
  const day = (await call('POST', '/market-days', { date: '2030-08-01' })).body.id;
  const pitch = (await call('POST', '/pitches', { number: uid(), size: 'small', power: false })).body.id;
  const vendor = (await call('POST', '/vendors', { businessName: `Farm ${uid()}`, contact: 'a@b.c', products: ['jam'] })).body.id;
  await call('POST', '/bookings', { vendorId: vendor, pitchId: pitch, marketDayId: day });
  const merchant = `M-${uid()}`;
  const sale = { saleId: `S-${uid()}`, merchantId: merchant, amountCents: 4200, time: '2030-08-01T10:00:00Z' };
  const tw = await fakeTillWave([sale, sale]);
  try {
    assert.equal((await call('PUT', '/config/tillwave', { baseUrl: tw.url })).status, 200);
    assert.equal((await call('POST', '/tillwave-links', { merchantId: merchant, vendorId: vendor, marketDayId: day })).status, 201);
    assert.equal((await call('POST', '/tillwave/poll')).status, 200);
    assert.equal((await call('POST', '/tillwave/poll')).status, 200);
    const sales = (await call('GET', `/vendors/${vendor}/sales?marketDayId=${day}`)).body;
    const tws = sales.filter((x) => x.provider === 'tillwave');
    assert.equal(tws.length, 1);
    assert.equal(tws[0].amountCents, 4200);
  } finally {
    tw.srv.close();
  }
});
