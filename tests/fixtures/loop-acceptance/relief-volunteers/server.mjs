// Demo reference service of the relief-volunteers acceptance contract (steps 1-4). A test fixture; not agent code.
import { newId, serve } from './_router.mjs';

const volunteers = new Map();
const incidents = new Map();
const shifts = new Map();
let medcertUrl = null;
let licenceCsvUrl = null;
let licences = null;

const CERTIFIED = new Set(['first-aid', 'heavy-machinery']);
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hoursOf = (s) => (minutes(s.end) - minutes(s.start)) / 60;
const overlaps = (a, b) => a.date === b.date && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
const today = () => new Date().toISOString().slice(0, 10);

async function verify(skill) {
  const c = skill.certification;
  if (c === undefined) return;
  if (skill.skill === 'first-aid') {
    if (medcertUrl === null) return void (c.confirmed = false);
    try {
      c.confirmed = (await fetch(`${medcertUrl}/certificates/${encodeURIComponent(c.number)}`)).status === 200;
    } catch {
      c.confirmed = false;
    }
  } else if (skill.skill === 'heavy-machinery') {
    c.confirmed = licences !== null && licences.has(c.number);
  } else c.confirmed = true;
}

/** The certification number a qualified assignment relies on, null when none is needed, undefined when unqualified. */
function qualification(v, s) {
  const k = v.skills.get(s.skill);
  if (k === undefined) return undefined;
  if (!CERTIFIED.has(s.skill)) return k.certification?.number ?? null;
  const c = k.certification;
  if (c === undefined || c.confirmed !== true || c.expiry < s.date) return undefined;
  return c.number;
}

function releaseUnqualified(v) {
  for (const s of shifts.values()) {
    if (s.date < today()) continue;
    const a = s.assigned.find((x) => x.volunteerId === v.id);
    if (a !== undefined && qualification(v, s) === undefined) s.assigned = s.assigned.filter((x) => x !== a);
  }
}

async function reverifyAll() {
  if (licenceCsvUrl !== null) {
    try {
      const text = await (await fetch(licenceCsvUrl)).text();
      licences = new Set(text.split('\n').map((l) => l.trim()).filter((l) => l !== '' && l !== 'licence'));
    } catch {
      // keep the last file
    }
  }
  for (const v of volunteers.values()) {
    for (const k of v.skills.values()) await verify(k);
    releaseUnqualified(v);
  }
}
setInterval(() => void reverifyAll().catch(() => undefined), 24 * 3600 * 1000).unref();

const view = (s) => ({ ...s, assigned: s.assigned.map((a) => a.volunteerId) });

serve([
  ['POST', '/volunteers', ({ body }) => {
    const v = { id: newId('vol'), name: body.name, contact: body.contact, homeRegion: body.homeRegion, skills: new Map() };
    volunteers.set(v.id, v);
    return [201, { id: v.id, name: v.name, contact: v.contact, homeRegion: v.homeRegion }];
  }],
  ['POST', '/volunteers/:id/skills', async ({ params, body }) => {
    const v = volunteers.get(params.id);
    if (v === undefined) return [404, { error: 'unknown' }];
    const k = { skill: body.skill, ...(body.certification !== undefined ? { certification: { ...body.certification } } : {}) };
    await verify(k);
    v.skills.set(k.skill, k);
    return [201, k];
  }],
  ['DELETE', '/volunteers/:id/skills/:skill', ({ params }) => {
    const v = volunteers.get(params.id);
    if (v === undefined) return [404, { error: 'unknown' }];
    v.skills.delete(params.skill);
    releaseUnqualified(v);
    return [204];
  }],
  ['POST', '/incidents', ({ body }) => {
    const i = { id: newId('incident'), name: body.name, region: body.region, startDate: body.startDate };
    incidents.set(i.id, i);
    return [201, i];
  }],
  ['POST', '/incidents/:id/shifts', ({ params, body }) => {
    if (!incidents.has(params.id)) return [404, { error: 'unknown' }];
    const s = { id: newId('shift'), incidentId: params.id, date: body.date, start: body.start, end: body.end, skill: body.skill, needed: body.needed, assigned: [] };
    shifts.set(s.id, s);
    return [201, view(s)];
  }],
  ['GET', '/shifts/:id', ({ params }) => (shifts.has(params.id) ? [200, view(shifts.get(params.id))] : [404, { error: 'unknown' }])],
  ['POST', '/shifts/:id/assignments', ({ params, body }) => {
    const s = shifts.get(params.id);
    const v = volunteers.get(body.volunteerId);
    if (s === undefined || v === undefined) return [404, { error: 'unknown' }];
    const cert = qualification(v, s);
    if (cert === undefined) return [422, { error: 'volunteer not qualified on the shift date' }];
    if (s.assigned.length >= s.needed) return [409, { error: 'shift full' }];
    const busy = [...shifts.values()].some((o) => o.id !== s.id && o.assigned.some((a) => a.volunteerId === v.id) && overlaps(o, s));
    if (busy) return [409, { error: 'overlapping shift' }];
    s.assigned.push({ volunteerId: v.id, certificationNumber: cert });
    return [201, view(s)];
  }],
  ['GET', '/incidents/:id/open-shifts', ({ params }) => [
    200,
    [...shifts.values()]
      .filter((s) => s.incidentId === params.id && s.assigned.length < s.needed)
      .map((s) => ({
        shiftId: s.id,
        open: s.needed - s.assigned.length,
        candidates: [...volunteers.values()]
          .filter((v) => !s.assigned.some((a) => a.volunteerId === v.id) && qualification(v, s) !== undefined)
          .filter((v) => ![...shifts.values()].some((o) => o.assigned.some((a) => a.volunteerId === v.id) && overlaps(o, s)))
          .map((v) => v.id),
      })),
  ]],
  ['PUT', '/config/medcert', ({ body }) => {
    medcertUrl = body.baseUrl;
    return [200, { baseUrl: medcertUrl }];
  }],
  ['PUT', '/config/licence-registry', ({ body }) => {
    licenceCsvUrl = body.csvUrl;
    return [200, { csvUrl: licenceCsvUrl }];
  }],
  ['POST', '/verifications/run', async () => {
    await reverifyAll();
    return [200, { ok: true }];
  }],
  ['GET', '/reports/impact', ({ query }) => {
    const month = query.get('month') ?? '';
    const rows = [];
    for (const i of incidents.values()) {
      const mine = [...shifts.values()].filter((s) => s.incidentId === i.id && s.date.startsWith(month));
      if (mine.length === 0) continue;
      const hoursBySkill = {};
      const ids = new Set();
      let places = 0;
      let filled = 0;
      for (const s of mine) {
        hoursBySkill[s.skill] = (hoursBySkill[s.skill] ?? 0) + hoursOf(s) * s.assigned.length;
        for (const a of s.assigned) ids.add(a.volunteerId);
        places += s.needed;
        filled += s.assigned.length;
      }
      const byRegion = {};
      for (const id of [...ids].sort()) {
        const r = volunteers.get(id)?.homeRegion ?? 'unknown';
        byRegion[r] = (byRegion[r] ?? 0) + 1;
      }
      rows.push({ incidentId: i.id, region: i.region, hoursBySkill, distinctVolunteers: ids.size, filledShare: places === 0 ? 0 : filled / places, volunteersByHomeRegion: byRegion });
    }
    return [200, rows];
  }],
  ['GET', '/volunteers/:id/service-record', ({ params }) => [
    200,
    [...shifts.values()].flatMap((s) =>
      s.assigned.filter((a) => a.volunteerId === params.id).map((a) => ({ shiftId: s.id, date: s.date, hours: hoursOf(s), skill: s.skill, certificationNumber: a.certificationNumber })),
    ),
  ]],
]);
