'use strict';
// HX study set part A, hxb2: runtime stand-in for the garment-care SDK whose typings the seed carries (src/types/pressline-sdk.d.ts).
// Tests drive it through globalThis.__presslineFake = { fail: { code, waitMin } | undefined, calls: [] }.
class PresslineError extends Error {
  constructor(code, waitMin) {
    super('pressline: ' + code);
    this.name = 'PresslineError';
    this.code = code;
    if (waitMin !== undefined) this.waitMin = waitMin;
  }
}
function fake() {
  const f = globalThis.__presslineFake;
  if (f === undefined) throw new Error('pressline-sdk stand-in: no globalThis.__presslineFake');
  return f;
}
class PresslineClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('pressline: apiKey required');
    this.shop = options.shop;
  }
  async dropOff(request) {
    const f = fake();
    f.calls.push({ op: 'dropOff', request });
    if (f.fail !== undefined) throw new PresslineError(f.fail.code, f.fail.waitMin);
    const n = f.calls.filter((c) => c.op === 'dropOff').length;
    return { ticketNo: 'PL-' + String(n), itemRef: request.itemRef, readyBy: '2026-12-20' };
  }
}
module.exports = { PresslineClient, PresslineError };
