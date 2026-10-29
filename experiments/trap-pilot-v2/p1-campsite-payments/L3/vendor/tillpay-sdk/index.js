'use strict';
// TRAP-PILOT-v2 P1 runtime stand-in for the card payments SDK whose typings the seed carries (src/types/tillpay-sdk.d.ts).
// Tests drive it through globalThis.__tillpayFake = { intents: { [id]: intent }, calls: [], refundState }.
class TillpayError extends Error {
  constructor(message, kind) { super(message); this.name = 'TillpayError'; this.kind = kind; }
}
function fake() {
  const f = globalThis.__tillpayFake;
  if (f === undefined) throw new Error('tillpay-sdk stand-in: no globalThis.__tillpayFake');
  return f;
}
function intentOf(f, id) {
  const i = f.intents[id];
  if (i === undefined) throw new TillpayError('No such payment intent: ' + id, 'api_error');
  return i;
}
class TillpayClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('tillpay: apiKey required');
    this.apiKey = options.apiKey;
  }
  async retrieveIntent(id) {
    const f = fake();
    f.calls.push({ op: 'retrieveIntent', id });
    return { ...intentOf(f, id) };
  }
  async captureIntent(id) {
    const f = fake();
    f.calls.push({ op: 'captureIntent', id });
    const i = intentOf(f, id);
    if (i.status === 'requires_capture') { i.status = 'succeeded'; i.amount_received = i.amount; }
    return { ...i };
  }
  async cancelIntent(id) {
    const f = fake();
    f.calls.push({ op: 'cancelIntent', id });
    const i = intentOf(f, id);
    if (i.status !== 'succeeded') i.status = 'canceled';
    return { ...i };
  }
  async refund(request) {
    const f = fake();
    f.calls.push({ op: 'refund', request });
    return { id: 're_' + String(f.calls.length), intent: request.intent, amount: request.amount, state: f.refundState ?? 'done' };
  }
}
module.exports = { TillpayClient, TillpayError };
