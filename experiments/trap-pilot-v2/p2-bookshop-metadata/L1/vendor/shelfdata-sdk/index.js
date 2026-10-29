'use strict';
// TRAP-PILOT-v2 P2 runtime stand-in for the book metadata SDK whose typings the seed carries (src/types/shelfdata-sdk.d.ts).
// Tests drive it through globalThis.__shelfdataFake = { volumes: [volume], calls: [] }.
class ShelfdataNotFound extends Error {
  constructor(message) { super(message); this.name = 'ShelfdataNotFound'; }
}
function fake() {
  const f = globalThis.__shelfdataFake;
  if (f === undefined) throw new Error('shelfdata-sdk stand-in: no globalThis.__shelfdataFake');
  return f;
}
class ShelfdataClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('shelfdata: apiKey required');
    this.apiKey = options.apiKey;
  }
  async lookupIsbn(isbn) {
    const f = fake();
    f.calls.push({ op: 'lookupIsbn', isbn });
    const v = f.volumes.find((x) => x.isbn_13 === isbn);
    if (v === undefined) throw new ShelfdataNotFound('No volume with ISBN ' + isbn);
    return { ...v };
  }
  async search(query) {
    const f = fake();
    f.calls.push({ op: 'search', query });
    const t = String(query.title ?? '').toLowerCase();
    return f.volumes.filter((v) => v.title_long.toLowerCase().includes(t)).slice(0, query.max_results ?? 20).map((v) => ({ ...v }));
  }
}
module.exports = { ShelfdataClient, ShelfdataNotFound };
