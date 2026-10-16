// Demo reference service of the shelter-adoptions acceptance contract (steps 1-4). A test fixture; not agent code.
import { newId, serve } from './_router.mjs';

const animals = new Map();
const applications = new Map();
const carers = new Map();
const placements = new Map();
const emails = [];
const sms = [];
const notifications = new Map();
const audit = [];

const actorOf = (h) => h['x-staff-id'] ?? 'staff';
function record(animalId, entity, entityId, actor, before, after) {
  audit.push({ animalId, entity, entityId, actor, at: new Date().toISOString(), before: before === null ? null : { ...before }, after: after === null ? null : { ...after } });
}
function change(obj, patch, animalId, entity, actor) {
  const before = { ...obj };
  Object.assign(obj, patch);
  record(animalId, entity, obj.id, actor, before, obj);
}

function notify(contact, subject, text) {
  if (contact.notify?.channel === 'sms') {
    const messageId = newId('sms');
    sms.push({ messageId, to: contact.notify.phone, text: text.slice(0, 160) });
    notifications.set(messageId, { id: messageId, channel: 'sms', to: contact.notify.phone, deliveryStatus: 'sent', fallback: { to: contact.email, subject, text } });
    return;
  }
  const id = newId('mail');
  emails.push({ to: contact.email, subject, body: text });
  notifications.set(id, { id, channel: 'email', to: contact.email, deliveryStatus: 'sent' });
}

function decide(app, status, actor) {
  const animal = animals.get(app.animalId);
  change(app, { status }, app.animalId, 'application', actor);
  notify(app.applicant, `Application ${status}`, `Your application for ${animal.name} was ${status}.`);
}

serve([
  ['POST', '/animals', ({ body, headers }) => {
    const a = { id: newId('animal'), species: body.species, name: body.name, estimatedAge: body.estimatedAge, intakeDate: body.intakeDate, medicalNotes: body.medicalNotes, status: 'intake' };
    animals.set(a.id, a);
    record(a.id, 'animal', a.id, actorOf(headers), null, a);
    return [201, a];
  }],
  ['POST', '/animals/:id/ready', ({ params, headers }) => {
    const a = animals.get(params.id);
    if (a === undefined) return [404, { error: 'unknown' }];
    change(a, { status: 'ready' }, a.id, 'animal', actorOf(headers));
    return [200, a];
  }],
  ['GET', '/animals/:id', ({ params }) => (animals.has(params.id) ? [200, animals.get(params.id)] : [404, { error: 'unknown' }])],
  ['POST', '/applications', ({ body, headers }) => {
    const a = animals.get(body.animalId);
    if (a === undefined) return [404, { error: 'unknown animal' }];
    if (a.status !== 'ready') return [409, { error: 'animal not ready for adoption' }];
    const app = { id: newId('app'), animalId: a.id, applicant: body.applicant, household: body.household, status: 'open' };
    applications.set(app.id, app);
    record(a.id, 'application', app.id, actorOf(headers), null, app);
    return [201, app];
  }],
  ['GET', '/applications/:id', ({ params }) => (applications.has(params.id) ? [200, applications.get(params.id)] : [404, { error: 'unknown' }])],
  ['POST', '/applications/:id/approve', ({ params, headers }) => {
    const app = applications.get(params.id);
    if (app === undefined || app.status !== 'open') return [409, { error: 'not open' }];
    const actor = actorOf(headers);
    decide(app, 'approved', actor);
    const animal = animals.get(app.animalId);
    change(animal, { status: 'adopted' }, animal.id, 'animal', actor);
    for (const other of applications.values()) if (other.animalId === animal.id && other.status === 'open') decide(other, 'rejected', actor);
    for (const p of placements.values()) {
      if (p.animalId !== animal.id || p.status !== 'active') continue;
      change(p, { status: 'ended' }, animal.id, 'placement', actor);
      const carer = carers.get(p.carerId);
      notify(carer, 'Placement ended', `${animal.name} has been adopted; the placement has ended.`);
    }
    return [200, app];
  }],
  ['POST', '/applications/:id/reject', ({ params, headers }) => {
    const app = applications.get(params.id);
    if (app === undefined || app.status !== 'open') return [409, { error: 'not open' }];
    decide(app, 'rejected', actorOf(headers));
    return [200, app];
  }],
  ['GET', '/outbox/emails', () => [200, emails]],
  ['POST', '/carers', ({ body }) => {
    const c = { id: newId('carer'), name: body.name, email: body.email, capacity: body.capacity, species: body.species ?? [], notify: body.notify };
    carers.set(c.id, c);
    return [201, c];
  }],
  ['POST', '/placements', ({ body, headers }) => {
    const c = carers.get(body.carerId);
    if (c === undefined || !animals.has(body.animalId)) return [404, { error: 'unknown' }];
    const hosted = [...placements.values()].filter((p) => p.carerId === c.id && p.status === 'active').length;
    if (hosted >= c.capacity) return [409, { error: 'carer at capacity' }];
    const p = { id: newId('placement'), animalId: body.animalId, carerId: c.id, status: 'active' };
    placements.set(p.id, p);
    record(p.animalId, 'placement', p.id, actorOf(headers), null, p);
    return [201, p];
  }],
  ['POST', '/placements/:id/end', ({ params, headers }) => {
    const p = placements.get(params.id);
    if (p === undefined) return [404, { error: 'unknown' }];
    change(p, { status: 'ended' }, p.animalId, 'placement', actorOf(headers));
    return [200, p];
  }],
  ['GET', '/placements/:id', ({ params }) => (placements.has(params.id) ? [200, placements.get(params.id)] : [404, { error: 'unknown' }])],
  ['GET', '/outbox/sms', () => [200, sms]],
  ['POST', '/webhooks/textbridge', ({ body }) => {
    const n = notifications.get(body.messageId);
    if (n === undefined) return [404, { error: 'unknown message' }];
    const before = { ...n };
    n.deliveryStatus = body.status;
    audit.push({ animalId: null, entity: 'notification', entityId: n.id, actor: 'system', at: new Date().toISOString(), before, after: { ...n } });
    if (body.status === 'failed' && n.fallback !== undefined) notify({ email: n.fallback.to }, n.fallback.subject, n.fallback.text);
    return [200, n];
  }],
  ['GET', '/notifications', () => [200, [...notifications.values()].map(({ fallback: _f, ...n }) => n)]],
  ['GET', '/animals/:id/audit', ({ params }) => [200, audit.filter((e) => e.animalId === params.id)]],
  ['GET', '/staff/:id/audit', ({ params, query }) => {
    const from = query.get('from') ?? '0000';
    const to = query.get('to') ?? '9999';
    return [200, audit.filter((e) => e.actor === params.id && e.at >= from && e.at <= to)];
  }],
]);
