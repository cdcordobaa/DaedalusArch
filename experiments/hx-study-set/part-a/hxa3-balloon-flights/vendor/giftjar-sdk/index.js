'use strict';
// HX study set part A, hxa3: runtime stand-in for the gift voucher SDK whose typings the seed carries (src/types/giftjar-sdk.d.ts).
// Tests drive it through globalThis.__giftjarFake = { vouchers: { [code]: voucher }, extensions: { [code]: outcome }, calls: [] }.
function fake() {
  const f = globalThis.__giftjarFake;
  if (f === undefined) throw new Error('giftjar-sdk stand-in: no globalThis.__giftjarFake');
  return f;
}
function voucherOf(f, code) {
  const v = f.vouchers[code];
  if (v === undefined) throw new Error('giftjar: unknown voucher ' + code);
  return v;
}
class GiftjarClient {
  constructor(options) {
    if (options === undefined || typeof options.merchantKey !== 'string' || options.merchantKey === '') throw new Error('giftjar: merchantKey required');
    this.merchantKey = options.merchantKey;
  }
  async lookup(code) {
    const f = fake();
    f.calls.push({ op: 'lookup', id: code });
    return { ...voucherOf(f, code) };
  }
  async redeem(request) {
    const f = fake();
    f.calls.push({ op: 'redeem', request });
    const v = voucherOf(f, request.code);
    const id = 'RD-' + String(f.calls.length);
    if (v.status !== 'activated' && v.status !== 'partially_redeemed') return { id, code: v.code, result: 'voucher_blocked', amount_cents: 0, short_by_cents: 0 };
    if (v.balance_cents < request.amount_cents) return { id, code: v.code, result: 'insufficient_balance', amount_cents: 0, short_by_cents: request.amount_cents - v.balance_cents };
    v.balance_cents -= request.amount_cents;
    v.status = v.balance_cents === 0 ? 'redeemed' : 'partially_redeemed';
    return { id, code: v.code, result: 'accepted', amount_cents: request.amount_cents, short_by_cents: 0 };
  }
  async extend(code) {
    const f = fake();
    f.calls.push({ op: 'extend', id: code });
    const v = voucherOf(f, code);
    return { code: v.code, outcome: (f.extensions && f.extensions[code]) || 'extended', expires_on: v.expires_on };
  }
}
module.exports = { GiftjarClient };
