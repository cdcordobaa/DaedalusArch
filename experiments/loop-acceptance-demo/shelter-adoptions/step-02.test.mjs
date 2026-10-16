// Demo acceptance tests, shelter-adoptions step 2 (fostering). Pilot task only.
//
// DEMO CONTRACT (adds to step 1):
//   POST /carers {name, email, capacity, species: [string]}  -> 201 {id}
//   POST /placements {animalId, carerId}                       -> 201 {id}; 409 carer at capacity
//   POST /placements/:id/end                                   -> 200
//   GET  /placements/:id                                       -> 200 {id, status: 'active'|'ended'}
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
const animal = async () => {
  const a = (await call('POST', '/animals', { species: 'cat', name: `Tom ${uid()}`, estimatedAge: 2, intakeDate: '2026-10-01', medicalNotes: '' })).body.id;
  await call('POST', `/animals/${a}/ready`);
  return a;
};

test('a carer never hosts more animals than their capacity', async () => {
  const carer = (await call('POST', '/carers', { name: 'Fay', email: `f${uid()}@x.org`, capacity: 1, species: ['cat'] })).body.id;
  assert.equal((await call('POST', '/placements', { animalId: await animal(), carerId: carer })).status, 201);
  assert.equal((await call('POST', '/placements', { animalId: await animal(), carerId: carer })).status, 409);
});

test('adopting a fostered animal ends the placement and e-mails the carer', async () => {
  const email = `g${uid()}@x.org`;
  const carer = (await call('POST', '/carers', { name: 'Gil', email, capacity: 2, species: ['cat'] })).body.id;
  const a = await animal();
  const placement = (await call('POST', '/placements', { animalId: a, carerId: carer })).body.id;
  const app = (await call('POST', '/applications', { animalId: a, applicant: { name: 'Hal', email: `h${uid()}@x.org` }, household: {} })).body.id;
  await call('POST', `/applications/${app}/approve`);
  assert.equal((await call('GET', `/placements/${placement}`)).body.status, 'ended');
  assert.ok((await call('GET', '/outbox/emails')).body.some((m) => m.to === email));
});
