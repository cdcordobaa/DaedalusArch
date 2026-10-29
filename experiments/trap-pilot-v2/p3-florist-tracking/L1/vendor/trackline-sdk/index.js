'use strict';
// TRAP-PILOT-v2 P3 runtime stand-in for the courier SDK whose typings the seed carries (src/types/trackline-sdk.d.ts).
// Tests drive it through globalThis.__tracklineFake = { shipments: [request], events: { [code]: [event] }, calls: [] }.
class TracklineError extends Error {
  constructor(message) { super(message); this.name = 'TracklineError'; }
}
function fake() {
  const f = globalThis.__tracklineFake;
  if (f === undefined) throw new Error('trackline-sdk stand-in: no globalThis.__tracklineFake');
  return f;
}
class TracklineClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('trackline: apiKey required');
    this.apiKey = options.apiKey;
  }
  async createShipment(request) {
    const f = fake();
    f.calls.push({ op: 'createShipment', request });
    f.shipments.push(request);
    const code = 'TL' + String(1000 + f.shipments.length);
    f.events[code] = [{ status: 'LABEL_CREATED', at: '2026-05-04T08:00:00Z', location: 'Florist' }];
    return { trackingCode: code, labelUrl: 'https://labels.example/' + code + '.pdf' };
  }
  async track(trackingCode) {
    const f = fake();
    f.calls.push({ op: 'track', trackingCode });
    const events = f.events[trackingCode];
    if (events === undefined) throw new TracklineError('Unknown tracking code ' + trackingCode);
    return { trackingCode, events: events.map((e) => ({ ...e })) };
  }
}
module.exports = { TracklineClient, TracklineError };
