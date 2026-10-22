'use strict';
// PUZZLE-01 runtime stand-in for the vendor SDK whose typings the seed carries (src/types/fastship-sdk.d.ts). Tests
// drive it through globalThis.__fastshipFake = { down, rates(request), tracking(no), calls }.
class FastshipUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'FastshipUnavailableError'; }
}
function fake() {
  const f = globalThis.__fastshipFake;
  if (f === undefined) throw new Error('fastship-sdk stand-in: no globalThis.__fastshipFake');
  return f;
}
class FastshipClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('fastship: apiKey required');
    this.apiKey = options.apiKey;
  }
  async rates(request) {
    const f = fake();
    f.calls.push({ op: 'rates', request });
    if (f.down) throw new FastshipUnavailableError('fastship is unavailable');
    return f.rates(request);
  }
  async tracking(trackingNumber) {
    const f = fake();
    f.calls.push({ op: 'tracking', trackingNumber });
    if (f.down) throw new FastshipUnavailableError('fastship is unavailable');
    return f.tracking(trackingNumber);
  }
}
module.exports = { FastshipClient, FastshipUnavailableError };
