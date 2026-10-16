// Demo acceptance tests, shelter-adoptions step 3 (SMS through TextBridge). Pilot task only.
//
// DEMO CONTRACT (adds to steps 1-2):
//   Applicants may give applicant.notify = {channel: 'sms', phone}.
//   GET  /outbox/sms                           -> 200 [{messageId, to, text}]   (the fake TextBridge client)
//   POST /webhooks/textbridge {messageId, status: 'delivered'|'failed'} -> 200; 'failed' re-sends the notification by e-mail
//   GET  /notifications                        -> 200 [{id, channel, to, deliveryStatus}]
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
test('an SMS that TextBridge reports failed is re-sent by e-mail', async () => {
  const a = (await call('POST', '/animals', { species: 'dog', name: `Max ${uid()}`, estimatedAge: 5, intakeDate: '2026-10-01', medicalNotes: '' })).body.id;
  await call('POST', `/animals/${a}/ready`);
  const phone = `+4470${Date.now() % 100000000}`;
  const email = `s${uid()}@x.org`;
  const app = (await call('POST', '/applications', { animalId: a, applicant: { name: 'Sam', email, notify: { channel: 'sms', phone } }, household: {} })).body.id;
  await call('POST', `/applications/${app}/approve`);
  const sms = (await call('GET', '/outbox/sms')).body.find((m) => m.to === phone);
  assert.ok(sms, 'an SMS to the applicant');
  assert.ok(sms.text.length <= 160);
  assert.ok(!(await call('GET', '/outbox/emails')).body.some((m) => m.to === email), 'no e-mail before the failure');
  assert.equal((await call('POST', '/webhooks/textbridge', { messageId: sms.messageId, status: 'failed' })).status, 200);
  assert.ok((await call('GET', '/outbox/emails')).body.some((m) => m.to === email), 'e-mail after the failure');
  const n = (await call('GET', '/notifications')).body.find((x) => x.to === phone);
  assert.equal(n.deliveryStatus, 'failed');
});
