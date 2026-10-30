'use strict';
// HX study set part A, hxb1: runtime stand-in for the wholesale SDK whose typings the seed carries (src/types/sackline-sdk.d.ts).
// Tests drive it through globalThis.__sacklineFake = { products: [product], fail: { code, shortfallCents } | undefined, calls: [] }.
class SacklineError extends Error {
  constructor(code, shortfallCents) {
    super('sackline: ' + code);
    this.name = 'SacklineError';
    this.code = code;
    if (shortfallCents !== undefined) this.shortfallCents = shortfallCents;
  }
}
function fake() {
  const f = globalThis.__sacklineFake;
  if (f === undefined) throw new Error('sackline-sdk stand-in: no globalThis.__sacklineFake');
  return f;
}
class SacklineClient {
  constructor(options) {
    if (options === undefined || typeof options.token !== 'string' || options.token === '') throw new Error('sackline: token required');
    this.account = options.account;
  }
  async products() {
    const f = fake();
    f.calls.push({ op: 'products' });
    return f.products.map((p) => ({ ...p }));
  }
  async placeOrder(request) {
    const f = fake();
    f.calls.push({ op: 'placeOrder', request });
    if (f.fail !== undefined) throw new SacklineError(f.fail.code, f.fail.shortfallCents);
    const p = f.products.find((x) => x.sku === request.sku);
    if (p === undefined) throw new Error('sackline: unknown sku ' + request.sku);
    const n = f.calls.filter((c) => c.op === 'placeOrder').length;
    return { orderNo: 'SL-' + String(n), sku: p.sku, bags: request.bags, totalCents: request.bags * p.priceCents, deliverOn: request.deliverOn };
  }
}
module.exports = { SacklineClient, SacklineError };
