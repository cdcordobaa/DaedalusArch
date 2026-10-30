'use strict';
// HX study set part A, hxa2: runtime stand-in for the hire-cover SDK whose typings the seed carries (src/types/covernest-sdk.d.ts).
// Tests drive it through globalThis.__covernestFake = { quotes: { [ref]: quote }, policies: { [quoteRef]: policy }, histories: { [hirerRef]: history }, calls: [] }.
function fake() {
  const f = globalThis.__covernestFake;
  if (f === undefined) throw new Error('covernest-sdk stand-in: no globalThis.__covernestFake');
  return f;
}
function found(map, key, what) {
  const v = map[key];
  if (v === undefined) throw new Error('covernest: no ' + what + ' ' + key);
  return { ...v };
}
class CovernestClient {
  constructor(options) {
    if (options === undefined || typeof options.partnerId !== 'string' || options.partnerId === '' || typeof options.secret !== 'string' || options.secret === '') throw new Error('covernest: partnerId and secret required');
    this.partnerId = options.partnerId;
  }
  async fetchQuote(quoteRef) {
    const f = fake();
    f.calls.push({ op: 'fetchQuote', id: quoteRef });
    return found(f.quotes, quoteRef, 'quote');
  }
  async policyForQuote(quoteRef) {
    const f = fake();
    f.calls.push({ op: 'policyForQuote', id: quoteRef });
    const p = found(f.policies, quoteRef, 'policy for quote');
    return { ...p, missingDocs: [...p.missingDocs] };
  }
  async claimsHistory(hirerRef) {
    const f = fake();
    f.calls.push({ op: 'claimsHistory', id: hirerRef });
    return found(f.histories, hirerRef, 'history');
  }
}
module.exports = { CovernestClient };
