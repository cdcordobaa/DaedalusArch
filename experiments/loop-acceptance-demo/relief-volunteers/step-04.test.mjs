// Demo acceptance tests, relief-volunteers step 4 (impact report). Pilot task only.
//
// DEMO CONTRACT (adds to steps 1-3):
//   GET /reports/impact?month=YYYY-MM -> 200 [{incidentId, region, hoursBySkill: {skill: hours}, distinctVolunteers, filledShare, volunteersByHomeRegion: {region: n}}]
//   GET /volunteers/:id/service-record -> 200 [{shiftId, date, hours, skill, certificationNumber}]
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
test('the monthly impact report counts hours, volunteers and filled share', async () => {
  const i = (await call('POST', '/incidents', { name: `Storm ${uid()}`, region: 'west', startDate: '2030-10-01' })).body.id;
  const s = (await call('POST', `/incidents/${i}/shifts`, { date: '2030-10-02', start: '08:00', end: '12:00', skill: 'logistics', needed: 4 })).body.id;
  for (const region of ['west', 'north']) {
    const v = (await call('POST', '/volunteers', { name: `V ${uid()}`, contact: 'v@x.org', homeRegion: region })).body.id;
    await call('POST', `/volunteers/${v}/skills`, { skill: 'logistics' });
    assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: v })).status, 201);
  }
  const r = await call('GET', '/reports/impact?month=2030-10');
  assert.equal(r.status, 200);
  const row = r.body.find((x) => x.incidentId === i);
  assert.equal(row.hoursBySkill.logistics, 8);
  assert.equal(row.distinctVolunteers, 2);
  assert.equal(row.filledShare, 0.5);
  assert.deepEqual(row.volunteersByHomeRegion, { north: 1, west: 1 });
});

test('a volunteer service record shows the certification each shift relied on', async () => {
  const i = (await call('POST', '/incidents', { name: `Slide ${uid()}`, region: 'west', startDate: '2030-10-05' })).body.id;
  const s = (await call('POST', `/incidents/${i}/shifts`, { date: '2030-10-06', start: '09:00', end: '12:00', skill: 'logistics', needed: 1 })).body.id;
  const v = (await call('POST', '/volunteers', { name: `V ${uid()}`, contact: 'v@x.org', homeRegion: 'west' })).body.id;
  await call('POST', `/volunteers/${v}/skills`, { skill: 'logistics' });
  await call('POST', `/shifts/${s}/assignments`, { volunteerId: v });
  const rec = (await call('GET', `/volunteers/${v}/service-record`)).body;
  assert.equal(rec.length, 1);
  assert.equal(rec[0].hours, 3);
  assert.ok('certificationNumber' in rec[0]);
});
