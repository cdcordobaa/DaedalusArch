'use strict';
// HX study set part B, hxpb3: runtime stand-in for the seat-booking SDK whose typings the seed carries
// (src/types/nightdome-sdk.d.ts). Tests drive it through
// globalThis.__nightdomeFake = { evenings: [evening], overcast: { nextClear } | undefined, calls: [] }.
function fake() {
  const f = globalThis.__nightdomeFake;
  if (f === undefined) throw new Error('nightdome-sdk stand-in: no globalThis.__nightdomeFake');
  return f;
}
class NightdomeClient {
  constructor(opts) {
    if (opts === undefined || typeof opts.apiKey !== 'string' || opts.apiKey === '') throw new Error('nightdome: apiKey required');
    if (typeof opts.observatory !== 'string' || opts.observatory === '') throw new Error('nightdome: observatory required');
    this.apiKey = opts.apiKey;
    this.observatory = opts.observatory;
  }
  async reserveSeats(input) {
    const f = fake();
    f.calls.push({ op: 'reserveSeats', input });
    if (f.overcast !== undefined) {
      const headers = f.overcast.nextClear !== undefined ? { 'x-next-clear-evening': f.overcast.nextClear } : {};
      return { status: 423, headers, json: { code: 'clouded_out', detail: 'Dome closed: overcast' } };
    }
    const e = f.evenings.find((x) => x.evening === input.evening);
    if (e === undefined) return { status: 400, headers: {}, json: { code: 'invalid', detail: 'No evening ' + input.evening } };
    if (e.seatsFree < input.seats) return { status: 409, headers: {}, json: { code: 'dome_full', detail: 'Not enough seats' } };
    e.seatsFree -= input.seats;
    return { status: 201, headers: { location: '/holds/ND-' + String(f.calls.length) }, json: { holdRef: 'ND-' + String(f.calls.length), evening: e.evening, seats: input.seats } };
  }
  async evenings(month) {
    const f = fake();
    f.calls.push({ op: 'evenings', month });
    return { status: 200, headers: {}, json: f.evenings.filter((x) => x.evening.startsWith(month)).map((x) => ({ ...x })) };
  }
}
module.exports = { NightdomeClient };
