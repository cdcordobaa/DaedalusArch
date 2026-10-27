'use strict';
// F2 runtime stand-in for the payment provider SDK whose typings the seed carries (src/types/paystream-sdk.d.ts).
// Tests drive it through globalThis.__paystreamFake = { down, charge(request), refund(request), calls }.
class PaystreamUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'PaystreamUnavailableError'; }
}
function fake() {
  const f = globalThis.__paystreamFake;
  if (f === undefined) throw new Error('paystream-sdk stand-in: no globalThis.__paystreamFake');
  return f;
}
class PaystreamClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('paystream: apiKey required');
    this.apiKey = options.apiKey;
  }
  async charge(request) {
    const f = fake();
    f.calls.push({ op: 'charge', request });
    if (f.down) throw new PaystreamUnavailableError('paystream is unavailable');
    return f.charge(request);
  }
  async refund(request) {
    const f = fake();
    f.calls.push({ op: 'refund', request });
    if (f.down) throw new PaystreamUnavailableError('paystream is unavailable');
    return f.refund(request);
  }
}
module.exports = { PaystreamClient, PaystreamUnavailableError };
