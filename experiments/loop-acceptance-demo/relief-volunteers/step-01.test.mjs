// Demo acceptance tests, relief-volunteers step 1 (registry and shifts). Pilot task only; not a Study 2 check.
//
// DEMO CONTRACT (all JSON; ids are strings the service returns):
//   POST /volunteers {name, contact, homeRegion}                          -> 201 {id}
//   POST /volunteers/:id/skills {skill, certification?: {number, expiry}} -> 201
//   POST /incidents {name, region, startDate}                             -> 201 {id}
//   POST /incidents/:id/shifts {date, start: 'HH:MM', end: 'HH:MM', skill, needed} -> 201 {id}
//   POST /shifts/:id/assignments {volunteerId}                            -> 201; 409 shift full or volunteer on an overlapping shift
//   GET  /shifts/:id                                                      -> 200 {id, assigned: [volunteerId]}
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
async function volunteer() {
  const v = (await call('POST', '/volunteers', { name: `Vol ${uid()}`, contact: 'v@x.org', homeRegion: 'north' })).body.id;
  await call('POST', `/volunteers/${v}/skills`, { skill: 'logistics' });
  return v;
}
async function shift(incident, date, start, end, needed) {
  return (await call('POST', `/incidents/${incident}/shifts`, { date, start, end, skill: 'logistics', needed })).body.id;
}
const incident = async () => (await call('POST', '/incidents', { name: `Flood ${uid()}`, region: 'north', startDate: '2030-03-01' })).body.id;

test('a shift never has more people than it needs', async () => {
  const s = await shift(await incident(), '2030-03-02', '08:00', '12:00', 1);
  assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: await volunteer() })).status, 201);
  assert.equal((await call('POST', `/shifts/${s}/assignments`, { volunteerId: await volunteer() })).status, 409);
  assert.equal((await call('GET', `/shifts/${s}`)).body.assigned.length, 1);
});

test('a volunteer is never on two overlapping shifts', async () => {
  const i = await incident();
  const v = await volunteer();
  const a = await shift(i, '2030-03-03', '08:00', '12:00', 3);
  const b = await shift(i, '2030-03-03', '11:00', '15:00', 3);
  const c = await shift(i, '2030-03-03', '12:00', '16:00', 3);
  assert.equal((await call('POST', `/shifts/${a}/assignments`, { volunteerId: v })).status, 201);
  assert.equal((await call('POST', `/shifts/${b}/assignments`, { volunteerId: v })).status, 409);
  assert.equal((await call('POST', `/shifts/${c}/assignments`, { volunteerId: v })).status, 201);
});
