// Demo acceptance tests, shelter-adoptions step 4 (audit trail). Pilot task only.
//
// DEMO CONTRACT (adds to steps 1-3):
//   Changing requests may carry the header X-Staff-Id ('system' for webhooks).
//   GET /animals/:id/audit                     -> 200 [{actor, at, entity, entityId, before, after}]  (animal, its applications and placements)
//   GET /staff/:id/audit?from=ISO&to=ISO       -> 200 [same entries]
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
test('an animal audit trail holds its own and its applications\' changes', async () => {
  const staff = `st-${uid()}`;
  const h = { 'x-staff-id': staff };
  const a = (await call('POST', '/animals', { species: 'dog', name: `Ace ${uid()}`, estimatedAge: 1, intakeDate: '2026-10-01', medicalNotes: '' }, h)).body.id;
  await call('POST', `/animals/${a}/ready`, undefined, h);
  const app = (await call('POST', '/applications', { animalId: a, applicant: { name: 'Ivy', email: `i${uid()}@x.org` }, household: {} })).body.id;
  await call('POST', `/applications/${app}/approve`, undefined, h);
  const trail = (await call('GET', `/animals/${a}/audit`)).body;
  assert.ok(trail.some((e) => e.entity === 'animal' && e.actor === staff));
  assert.ok(trail.some((e) => e.entity === 'application' && e.after?.status === 'approved'));
  const mine = await call('GET', `/staff/${staff}/audit?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z`);
  assert.equal(mine.status, 200);
  assert.ok(mine.body.length >= 3);
  assert.ok(mine.body.every((e) => e.actor === staff));
});
