'use strict';
// HX study set part B, hxpb1: runtime stand-in for the kiln-controller SDK whose typings the seed carries
// (src/types/kilnwise-sdk.d.ts). Tests drive it through
// globalThis.__kilnwiseFake = { firings: [request], readings: { [firingId]: [reading, newest first] }, calls: [] }.
class KilnwiseError extends Error {
  constructor(message) { super(message); this.name = 'KilnwiseError'; }
}
function fake() {
  const f = globalThis.__kilnwiseFake;
  if (f === undefined) throw new Error('kilnwise-sdk stand-in: no globalThis.__kilnwiseFake');
  return f;
}
class KilnwiseClient {
  constructor(options) {
    if (options === undefined || typeof options.token !== 'string' || options.token === '') throw new Error('kilnwise: token required');
    if (typeof options.studio !== 'string' || options.studio === '') throw new Error('kilnwise: studio required');
    this.token = options.token;
    this.studio = options.studio;
  }
  async scheduleFiring(request) {
    const f = fake();
    f.calls.push({ op: 'scheduleFiring', request });
    f.firings.push(request);
    const firingId = 'KW-' + String(40 + f.firings.length);
    f.readings[firingId] = [{ phase: 'SCHEDULED', celsius: 21, takenAt: '2026-03-02T08:00:00Z' }];
    return { firingId, kilnName: 'Big Blue' };
  }
  async firingStatus(firingId) {
    const f = fake();
    f.calls.push({ op: 'firingStatus', firingId });
    const readings = f.readings[firingId];
    if (readings === undefined) throw new KilnwiseError('Unknown firing ' + firingId);
    return { firingId, readings: readings.map((r) => ({ ...r })) };
  }
}
module.exports = { KilnwiseClient, KilnwiseError };
