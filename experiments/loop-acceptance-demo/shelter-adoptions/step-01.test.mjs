// Demo acceptance tests, shelter-adoptions step 1 (adoptions). Pilot task only; not a Study 2 check.
//
// DEMO CONTRACT (all JSON; ids are strings the service returns):
//   POST /animals {species, name, estimatedAge, intakeDate, medicalNotes}      -> 201 {id}
//   POST /animals/:id/ready                                                     -> 200
//   GET  /animals/:id                                                           -> 200 {id, status: 'intake'|'ready'|'adopted', ...}
//   POST /applications {animalId, applicant: {name, email}, household}          -> 201 {id}; 409 animal not ready
//   POST /applications/:id/approve | /reject                                    -> 200
//   GET  /applications/:id                                                      -> 200 {id, status: 'open'|'approved'|'rejected'}
//   GET  /outbox/emails                                                         -> 200 [{to, subject, body}]   (the fake mail provider)
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
async function readyAnimal() {
  const a = (await call('POST', '/animals', { species: 'dog', name: `Rex ${uid()}`, estimatedAge: 3, intakeDate: '2026-10-01', medicalNotes: '' })).body.id;
  assert.equal((await call('POST', `/animals/${a}/ready`)).status, 200);
  return a;
}
const apply = async (animalId, email) => call('POST', '/applications', { animalId, applicant: { name: 'Ann', email }, household: { adults: 2 } });

test('approving one application adopts the animal and rejects the others', async () => {
  const a = await readyAnimal();
  const first = (await apply(a, `a${uid()}@x.org`)).body.id;
  const second = (await apply(a, `b${uid()}@x.org`)).body.id;
  assert.equal((await call('POST', `/applications/${first}/approve`)).status, 200);
  assert.equal((await call('GET', `/animals/${a}`)).body.status, 'adopted');
  assert.equal((await call('GET', `/applications/${second}`)).body.status, 'rejected');
});

test('the applicant is e-mailed when the application is decided', async () => {
  const a = await readyAnimal();
  const email = `c${uid()}@x.org`;
  const id = (await apply(a, email)).body.id;
  await call('POST', `/applications/${id}/reject`);
  const mails = (await call('GET', '/outbox/emails')).body;
  assert.ok(mails.some((m) => m.to === email));
});
