'use strict';
// TRAP-PILOT-v2 P6 runtime stand-in for the capacity SDK whose typings the seed carries (src/types/crowdgate-sdk.d.ts).
// Tests drive it through globalThis.__crowdgateFake = { slots: [slot], busy: { retryAfter } | undefined, calls: [] }.
function fake() {
  const f = globalThis.__crowdgateFake;
  if (f === undefined) throw new Error('crowdgate-sdk stand-in: no globalThis.__crowdgateFake');
  return f;
}
class CrowdgateClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('crowdgate: apiKey required');
    this.apiKey = options.apiKey;
  }
  async holdEntry(request) {
    const f = fake();
    f.calls.push({ op: 'holdEntry', request });
    if (f.busy !== undefined) {
      const headers = f.busy.retryAfter !== undefined ? { 'retry-after': f.busy.retryAfter } : {};
      return { status: 429, headers, body: { error: 'rate_limited', message: 'Too many requests' } };
    }
    const s = f.slots.find((x) => x.slot === request.slot);
    if (s === undefined) return { status: 400, headers: {}, body: { error: 'bad_request', message: 'Unknown slot ' + request.slot } };
    if (s.left < request.visitors) {
      const next = f.slots.find((x) => x.slot > s.slot && x.slot.slice(0, 10) === s.slot.slice(0, 10) && x.left >= request.visitors);
      return { status: 409, headers: next !== undefined ? { 'x-next-slot': next.slot } : {}, body: { error: 'slot_full', message: 'Slot is full' } };
    }
    s.left -= request.visitors;
    return { status: 201, headers: {}, body: { holdId: 'H-' + String(f.calls.length), slot: s.slot, visitors: request.visitors } };
  }
  async slots(day) {
    const f = fake();
    f.calls.push({ op: 'slots', day });
    return { status: 200, headers: {}, body: f.slots.filter((x) => x.slot.startsWith(day)).map((x) => ({ ...x })) };
  }
}
module.exports = { CrowdgateClient };
