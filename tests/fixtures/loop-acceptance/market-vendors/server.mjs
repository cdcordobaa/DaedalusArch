// Demo reference service of the market-vendors acceptance contract (steps 1-4). A test fixture; not agent code.
import { newId, serve } from './_router.mjs';

const days = new Map();
const pitches = new Map();
const vendors = new Map();
const bookings = new Map();
const readerLinks = [];
const merchantLinks = [];
const sales = [];
const seenTillWave = new Set();
const fees = new Map();
const carried = new Map();
const payouts = [];
const audit = [];
let tillwaveUrl = null;

const actorOf = (h, fallback = 'system') => h['x-organiser-id'] ?? fallback;
function record(marketDayId, entity, actor, before, after) {
  audit.push({ marketDayId, entity, actor, at: new Date().toISOString(), before, after });
}
const bookingOn = (vendorId, marketDayId) => [...bookings.values()].find((b) => b.vendorId === vendorId && b.marketDayId === marketDayId);
const dayOfDate = (date) => [...days.values()].filter((d) => d.date === date);

function addSale(vendorId, marketDayId, amountCents, provider, actor) {
  const day = days.get(marketDayId);
  if (day.settled) return [409, { error: 'market day settled' }];
  const sale = { vendorId, marketDayId, amountCents, provider };
  sales.push(sale);
  record(marketDayId, 'sale', actor, null, sale);
  return [201, sale];
}

function vendorFee(b) {
  const p = pitches.get(b.pitchId);
  const f = fees.get(p.size) ?? { feeCents: 0, powerSurchargeCents: 0 };
  return f.feeCents + (p.power ? f.powerSurchargeCents : 0);
}

async function pollTillWave() {
  if (tillwaveUrl === null) return;
  const list = await (await fetch(`${tillwaveUrl}/sales`)).json();
  for (const s of list) {
    if (seenTillWave.has(s.saleId)) continue;
    const date = s.time.slice(0, 10);
    const link = merchantLinks.find((l) => l.merchantId === s.merchantId && days.get(l.marketDayId)?.date === date);
    if (link === undefined || bookingOn(link.vendorId, link.marketDayId) === undefined) continue;
    seenTillWave.add(s.saleId);
    addSale(link.vendorId, link.marketDayId, s.amountCents, 'tillwave', 'system');
  }
}
setInterval(() => void pollTillWave().catch(() => undefined), 15 * 60 * 1000).unref();

serve([
  ['POST', '/market-days', ({ body }) => {
    const d = { id: newId('day'), date: body.date, closed: false, settled: false };
    days.set(d.id, d);
    return [201, d];
  }],
  ['POST', '/pitches', ({ body }) => {
    const p = { id: newId('pitch'), number: body.number, size: body.size, power: body.power === true };
    pitches.set(p.id, p);
    return [201, p];
  }],
  ['POST', '/vendors', ({ body }) => {
    const v = { id: newId('vendor'), businessName: body.businessName, contact: body.contact, products: body.products ?? [], commission: 0.05 };
    vendors.set(v.id, v);
    return [201, v];
  }],
  ['POST', '/bookings', ({ body, headers }) => {
    const day = days.get(body.marketDayId);
    if (day === undefined || !pitches.has(body.pitchId) || !vendors.has(body.vendorId)) return [404, { error: 'unknown' }];
    if (day.settled) return [409, { error: 'settled' }];
    const all = [...bookings.values()].filter((b) => b.marketDayId === body.marketDayId);
    if (all.some((b) => b.pitchId === body.pitchId)) return [409, { error: 'pitch taken' }];
    if (all.some((b) => b.vendorId === body.vendorId)) return [409, { error: 'vendor already has a pitch' }];
    const b = { id: newId('booking'), vendorId: body.vendorId, pitchId: body.pitchId, marketDayId: body.marketDayId };
    bookings.set(b.id, b);
    record(b.marketDayId, 'booking', actorOf(headers, 'organiser'), null, b);
    return [201, b];
  }],
  ['DELETE', '/bookings/:id', ({ params, headers }) => {
    const b = bookings.get(params.id);
    if (b === undefined) return [404, { error: 'unknown' }];
    const day = days.get(b.marketDayId);
    if (day.settled) return [409, { error: 'settled' }];
    if (Date.parse(`${day.date}T00:00:00Z`) - Date.now() < 48 * 3600 * 1000) return [409, { error: 'too late to cancel' }];
    bookings.delete(b.id);
    record(b.marketDayId, 'booking', actorOf(headers, 'organiser'), b, null);
    return [204];
  }],
  ['POST', '/reader-links', ({ body }) => {
    readerLinks.push({ readerId: body.readerId, vendorId: body.vendorId, marketDayId: body.marketDayId });
    return [201, body];
  }],
  ['POST', '/webhooks/paylane', ({ body }) => {
    const date = String(body.time ?? '').slice(0, 10);
    const ids = new Set(dayOfDate(date).map((d) => d.id));
    const link = readerLinks.find((l) => l.readerId === body.readerId && ids.has(l.marketDayId) && bookingOn(l.vendorId, l.marketDayId) !== undefined);
    if (link === undefined) return [422, { error: 'reader not linked to a booked vendor that day' }];
    return addSale(link.vendorId, link.marketDayId, body.amountCents, 'paylane', 'system');
  }],
  ['GET', '/vendors/:id/sales', ({ params, query }) => {
    const day = query.get('marketDayId');
    return [200, sales.filter((s) => s.vendorId === params.id && (day === null || s.marketDayId === day)).map(({ amountCents, provider }) => ({ amountCents, provider }))];
  }],
  ['PUT', '/fees/:size', ({ params, body }) => {
    fees.set(params.size, { feeCents: body.feeCents, powerSurchargeCents: body.powerSurchargeCents ?? 0 });
    return [200, fees.get(params.size)];
  }],
  ['PUT', '/vendors/:id/commission', ({ params, body }) => {
    const v = vendors.get(params.id);
    if (v === undefined) return [404, { error: 'unknown' }];
    v.commission = body.rate;
    return [200, v];
  }],
  ['POST', '/market-days/:id/close', ({ params }) => {
    const d = days.get(params.id);
    if (d === undefined) return [404, { error: 'unknown' }];
    d.closed = true;
    return [200, d];
  }],
  ['POST', '/market-days/:id/settlement', ({ params, headers }) => {
    const d = days.get(params.id);
    if (d === undefined) return [404, { error: 'unknown' }];
    if (!d.closed || d.settled) return [409, { error: 'not closed or already settled' }];
    const out = [];
    for (const b of [...bookings.values()].filter((x) => x.marketDayId === d.id)) {
      const total = sales.filter((s) => s.vendorId === b.vendorId && s.marketDayId === d.id).reduce((a, s) => a + s.amountCents, 0);
      const net = total - Math.round(total * vendors.get(b.vendorId).commission) - vendorFee(b) - (carried.get(b.vendorId) ?? 0);
      const p = { vendorId: b.vendorId, marketDayId: d.id, month: d.date.slice(0, 7), feeCents: vendorFee(b), payoutCents: Math.max(0, net), carriedCents: Math.max(0, -net) };
      carried.set(b.vendorId, p.carriedCents);
      payouts.push(p);
      out.push(p);
    }
    d.settled = true;
    record(d.id, 'settlement', actorOf(headers, 'organiser'), null, out);
    return [200, { payouts: out }];
  }],
  ['PUT', '/config/tillwave', ({ body }) => {
    tillwaveUrl = body.baseUrl;
    return [200, { baseUrl: tillwaveUrl }];
  }],
  ['POST', '/tillwave-links', ({ body }) => {
    merchantLinks.push({ merchantId: body.merchantId, vendorId: body.vendorId, marketDayId: body.marketDayId });
    return [201, body];
  }],
  ['POST', '/tillwave/poll', async () => {
    await pollTillWave();
    return [200, { ok: true }];
  }],
  ['GET', '/market-days/:id/audit', ({ params }) => [200, audit.filter((a) => a.marketDayId === params.id)]],
  ['GET', '/vendors/:id/statements/:month', ({ params }) => {
    const inMonth = (dayId) => days.get(dayId)?.date.startsWith(params.month) === true;
    const mine = sales.filter((s) => s.vendorId === params.id && inMonth(s.marketDayId));
    const pays = payouts.filter((p) => p.vendorId === params.id && p.month === params.month);
    return [200, {
      bookings: [...bookings.values()].filter((b) => b.vendorId === params.id && inMonth(b.marketDayId)),
      salesByProvider: { paylane: mine.filter((s) => s.provider === 'paylane').reduce((a, s) => a + s.amountCents, 0), tillwave: mine.filter((s) => s.provider === 'tillwave').reduce((a, s) => a + s.amountCents, 0) },
      feesCents: pays.reduce((a, p) => a + p.feeCents, 0),
      payoutsCents: pays.reduce((a, p) => a + p.payoutCents, 0),
      carriedCents: carried.get(params.id) ?? 0,
    }];
  }],
]);
