// Demo acceptance tests, relief-volunteers step 3 (licence registry). Pilot task only.
//
// DEMO CONTRACT (adds to steps 1-2):
//   PUT  /config/licence-registry {csvUrl}   -> 200; the CSV has one licence number per line (header 'licence')
//   POST /verifications/run                  -> 200 (re-verifies every certification now; the daily timer does the same)
//   A heavy-machinery certification is valid only while its number is in the latest CSV.
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
test('heavy-machinery licences are valid only while in the registry CSV', async () => {
  const listed = `HM-${uid()}`;
  const unlisted = `HM-${uid()}`;
  const srv = await new Promise((resolve) => {
    const s = createServer((_req, res) => {
      res.setHeader('content-type', 'text/csv');
      res.end(`licence\n${listed}\n`);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    assert.equal((await call('PUT', '/config/licence-registry', { csvUrl: `http://127.0.0.1:${srv.address().port}/licences.csv` })).status, 200);
    const i = (await call('POST', '/incidents', { name: `Quake ${uid()}`, region: 'east', startDate: '2030-05-01' })).body.id;
    const s = (await call('POST', `/incidents/${i}/shifts`, { date: '2030-05-02', start: '08:00', end: '16:00', skill: 'heavy-machinery', needed: 4 })).body.id;
    const a = (await call('POST', '/volunteers', { name: 'Ada', contact: 'a@x.org', homeRegion: 'east' })).body.id;
    const b = (await call('POST', '/volunteers', { name: 'Bo', contact: 'b@x.org', homeRegion: 'east' })).body.id;
    await call('POST', `/volunteers/${a}/skills`, { skill: 'heavy-machinery', certification: { number: listed, expiry: '2031-01-01' } });
    await call('POST', `/volunteers/${b}/skills`, { skill: 'heavy-machinery', certification: { number: unlisted, expiry: '2031-01-01' } });
    assert.equal((await call('POST', '/verifications/run')).status, 200);
    assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: a })).status, 201);
    assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: b })).status, 422);
  } finally {
    srv.close();
  }
});
