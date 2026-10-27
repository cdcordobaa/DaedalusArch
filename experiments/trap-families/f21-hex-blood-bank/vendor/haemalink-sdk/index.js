'use strict';
// F21 runtime stand-in for the vendor SDK whose typings the seed carries (src/types/haemalink-sdk.d.ts). Tests drive it
// through globalThis.__haemalinkFake = { calls, submit(request, n), consignment(orderRef) }. submit returns
// { allocate: number[] } (units allocated per line), { embargo: { code, liftsAt } } or { fail: httpStatus }.
class HaemalinkError extends Error {
  constructor(message, httpStatus) { super(message); this.name = 'HaemalinkError'; this.httpStatus = httpStatus; }
}
class HaemalinkEmbargoError extends HaemalinkError {
  constructor(embargoCode, liftsAt, lineNo) {
    super(`haemalink: line ${lineNo} under embargo (${embargoCode}) until ${liftsAt}`, 409);
    this.name = 'HaemalinkEmbargoError';
    this.embargoCode = embargoCode;
    this.liftsAt = liftsAt;
    this.lineNo = lineNo;
  }
}
function fake() {
  const f = globalThis.__haemalinkFake;
  if (f === undefined) throw new Error('haemalink-sdk stand-in: no globalThis.__haemalinkFake');
  return f;
}
class HaemalinkClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('haemalink: apiKey required');
    if (typeof options.siteCode !== 'string' || options.siteCode === '') throw new Error('haemalink: siteCode required');
    this.apiKey = options.apiKey;
    this.siteCode = options.siteCode;
  }
  async submitOrder(request) {
    const f = fake();
    const n = f.calls.filter((c) => c.op === 'submitOrder').length;
    f.calls.push({ op: 'submitOrder', siteCode: this.siteCode, request: JSON.parse(JSON.stringify(request)) });
    const answer = f.submit(request, n);
    if (answer.fail !== undefined) throw new HaemalinkError(`haemalink: service answered ${answer.fail}`, answer.fail);
    if (answer.embargo !== undefined) throw new HaemalinkEmbargoError(answer.embargo.code, answer.embargo.liftsAt, 1);
    const allocations = request.lines.map((line, i) => {
      const got = Math.max(0, Math.min(line.qty, answer.allocate === undefined ? line.qty : answer.allocate[i] ?? 0));
      return { lineNo: i + 1, qtyRequested: line.qty, qtyAllocated: got, allocationStatus: got === line.qty ? 'ALLOCATED' : got === 0 ? 'BACKORDERED' : 'PART_ALLOCATED' };
    });
    return { orderRef: `HL-${String(7001 + n)}`, allocations, etaMinutes: request.priority === 'STAT' ? 40 : 360 };
  }
  async consignment(orderRef) {
    const f = fake();
    f.calls.push({ op: 'consignment', orderRef });
    return f.consignment(orderRef);
  }
}
module.exports = { HaemalinkClient, HaemalinkError, HaemalinkEmbargoError };
