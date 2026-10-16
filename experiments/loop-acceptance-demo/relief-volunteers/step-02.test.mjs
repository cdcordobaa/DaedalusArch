// Demo acceptance tests, relief-volunteers step 2 (qualified assignments). Pilot task only.
//
// DEMO CONTRACT (adds to step 1):
//   PUT    /config/medcert {baseUrl}             -> 200; the service calls GET <baseUrl>/certificates/:number (200 = confirmed, 404 = not)
//   POST   /shifts/:id/assignments               -> 422 when the volunteer lacks the skill or a certification valid on the shift date
//   DELETE /volunteers/:id/skills/:skill         -> 204; the volunteer's future shifts needing it are released
//   GET    /incidents/:id/open-shifts            -> 200 [{shiftId, open, candidates: [volunteerId]}]
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
function fakeMedCert(valid) {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      const n = decodeURIComponent(req.url.split('/').pop());
      res.statusCode = valid.has(n) ? 200 : 404;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ number: n, valid: valid.has(n) }));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}
const incident = async () => (await call('POST', '/incidents', { name: `Fire ${uid()}`, region: 'south', startDate: '2030-04-01' })).body.id;
const vol = async () => (await call('POST', '/volunteers', { name: `Vol ${uid()}`, contact: 'v@x.org', homeRegion: 'south' })).body.id;

test('assignment needs the skill and a certification valid on the shift date', async () => {
  const good = `FA-${uid()}`;
  const unconfirmed = `FA-${uid()}`;
  const mc = await fakeMedCert(new Set([good]));
  try {
    await call('PUT', '/config/medcert', { baseUrl: mc.url });
    const i = await incident();
    const s = (await call('POST', `/incidents/${i}/shifts`, { date: '2030-04-02', start: '08:00', end: '12:00', skill: 'first-aid', needed: 5 })).body.id;
    const ok = await vol();
    await call('POST', `/volunteers/${ok}/skills`, { skill: 'first-aid', certification: { number: good, expiry: '2031-01-01' } });
    const expired = await vol();
    await call('POST', `/volunteers/${expired}/skills`, { skill: 'first-aid', certification: { number: good, expiry: '2030-04-01' } });
    const notConfirmed = await vol();
    await call('POST', `/volunteers/${notConfirmed}/skills`, { skill: 'first-aid', certification: { number: unconfirmed, expiry: '2031-01-01' } });
    const noSkill = await vol();
    assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: ok })).status, 201);
    assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: expired })).status, 422);
    assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: notConfirmed })).status, 422);
    assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: noSkill })).status, 422);
  } finally {
    mc.srv.close();
  }
});

test('a withdrawn skill releases future shifts, which show as open with candidates', async () => {
  const i = await incident();
  const s = (await call('POST', `/incidents/${i}/shifts`, { date: '2030-04-05', start: '08:00', end: '12:00', skill: 'logistics', needed: 1 })).body.id;
  const v = await vol();
  const w = await vol();
  await call('POST', `/volunteers/${v}/skills`, { skill: 'logistics' });
  await call('POST', `/volunteers/${w}/skills`, { skill: 'logistics' });
  assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: v })).status, 201);
  assert.equal((await call('DELETE', `/volunteers/${v}/skills/logistics`)).status, 204);
  const open = (await call('GET', `/incidents/${i}/open-shifts`)).body.find((x) => x.shiftId === s);
  assert.equal(open.open, 1);
  assert.ok(open.candidates.includes(w));
  assert.ok(!open.candidates.includes(v));
});
