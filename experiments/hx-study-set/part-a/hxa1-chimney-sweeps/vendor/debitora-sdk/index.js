'use strict';
// HX study set part A, hxa1: runtime stand-in for the direct debit SDK whose typings the seed carries (src/types/debitora-sdk.d.ts).
// Tests drive it through globalThis.__debitoraFake = { mandates: { [id]: mandate }, payments: { [id]: payment }, calls: [] }.
class DebitoraError extends Error {
  constructor(message, type) { super(message); this.name = 'DebitoraError'; this.type = type; }
}
function fake() {
  const f = globalThis.__debitoraFake;
  if (f === undefined) throw new Error('debitora-sdk stand-in: no globalThis.__debitoraFake');
  return f;
}
class DebitoraClient {
  constructor(options) {
    if (options === undefined || typeof options.accessToken !== 'string' || options.accessToken === '') throw new Error('debitora: accessToken required');
    this.accessToken = options.accessToken;
  }
  async getMandate(id) {
    const f = fake();
    f.calls.push({ op: 'getMandate', id });
    const m = f.mandates[id];
    if (m === undefined) throw new DebitoraError('No such mandate: ' + id, 'invalid_api_usage');
    return { ...m };
  }
  async createPayment(params) {
    const f = fake();
    f.calls.push({ op: 'createPayment', request: params });
    const m = f.mandates[params.mandate];
    if (m === undefined) throw new DebitoraError('No such mandate: ' + params.mandate, 'invalid_api_usage');
    const id = 'PM' + String(Object.keys(f.payments).length + 1).padStart(3, '0');
    const p = { id, mandate: params.mandate, amount: params.amount, currency: params.currency, status: m.status === 'active' ? 'pending_submission' : 'failed', charge_date: m.next_possible_charge_date, description: params.description };
    f.payments[id] = p;
    return { ...p };
  }
  async getPayment(id) {
    const f = fake();
    f.calls.push({ op: 'getPayment', id });
    const p = f.payments[id];
    if (p === undefined) throw new DebitoraError('No such payment: ' + id, 'invalid_api_usage');
    return { ...p };
  }
}
module.exports = { DebitoraClient, DebitoraError };
