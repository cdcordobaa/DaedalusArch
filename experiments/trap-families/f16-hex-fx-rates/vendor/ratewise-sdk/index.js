'use strict';
// F16 runtime stand-in for the exchange-rate SDK whose typings the seed carries (src/types/ratewise-sdk.d.ts).
// Tests drive it through globalThis.__ratewiseFake = { down, latest(request), currencies(request), calls }.
class RatewiseUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'RatewiseUnavailableError'; }
}
function fake() {
  const f = globalThis.__ratewiseFake;
  if (f === undefined) throw new Error('ratewise-sdk stand-in: no globalThis.__ratewiseFake');
  return f;
}
class RatewiseClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('ratewise: apiKey required');
    this.apiKey = options.apiKey;
  }
  async latest(request) {
    const f = fake();
    f.calls.push({ op: 'latest', request });
    if (f.down) throw new RatewiseUnavailableError('ratewise is unavailable');
    return f.latest(request);
  }
  async currencies(request) {
    const f = fake();
    f.calls.push({ op: 'currencies', request });
    if (f.down) throw new RatewiseUnavailableError('ratewise is unavailable');
    return f.currencies(request);
  }
}
module.exports = { RatewiseClient, RatewiseUnavailableError };
