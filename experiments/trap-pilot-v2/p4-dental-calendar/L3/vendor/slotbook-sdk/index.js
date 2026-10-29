'use strict';
// TRAP-PILOT-v2 P4 runtime stand-in for the calendar SDK whose typings the seed carries (src/types/slotbook-sdk.d.ts).
// Tests drive it through globalThis.__slotbookFake = { slots: [slot], fail: { code, retryAfterSec } | undefined, calls: [] }.
class SlotbookError extends Error {
  constructor(code, retryAfterSec) {
    super('slotbook: ' + code);
    this.name = 'SlotbookError';
    this.code = code;
    if (retryAfterSec !== undefined) this.retryAfterSec = retryAfterSec;
  }
}
function fake() {
  const f = globalThis.__slotbookFake;
  if (f === undefined) throw new Error('slotbook-sdk stand-in: no globalThis.__slotbookFake');
  return f;
}
class SlotbookClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('slotbook: apiKey required');
    this.apiKey = options.apiKey;
  }
  async freeSlots(query) {
    const f = fake();
    f.calls.push({ op: 'freeSlots', query });
    return f.slots.filter((s) => s.startsAt >= query.from && s.startsAt < query.to && (query.chairId === undefined || s.chairId === query.chairId)).map((s) => ({ ...s }));
  }
  async reserve(request) {
    const f = fake();
    f.calls.push({ op: 'reserve', request });
    if (f.fail !== undefined) {
      const { code, retryAfterSec } = f.fail;
      if (code === 'SLOT_TAKEN') f.slots = f.slots.filter((s) => s.slotId !== request.slotId);
      throw new SlotbookError(code, retryAfterSec);
    }
    f.slots = f.slots.filter((s) => s.slotId !== request.slotId);
    return { reservationId: 'R-' + request.slotId, slotId: request.slotId };
  }
}
module.exports = { SlotbookClient, SlotbookError };
