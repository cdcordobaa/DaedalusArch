'use strict';
// HX study set part B, hxpb2: runtime stand-in for the translator-marketplace SDK whose typings the seed carries
// (src/types/wordmarket-sdk.d.ts). Tests drive it through
// globalThis.__wordmarketFake = { posted: [input], jobs: { [id]: { state, translatorHandle, updatedAt } }, calls: [] }.
class WordmarketApiError extends Error {
  constructor(reason, message) { super(message); this.name = 'WordmarketApiError'; this.reason = reason; }
}
function fake() {
  const f = globalThis.__wordmarketFake;
  if (f === undefined) throw new Error('wordmarket-sdk stand-in: no globalThis.__wordmarketFake');
  return f;
}
class Wordmarket {
  constructor(config) {
    if (config === undefined || typeof config.apiToken !== 'string' || config.apiToken === '') throw new Error('wordmarket: apiToken required');
    this.apiToken = config.apiToken;
    this.jobs = {
      post: async (input) => {
        const f = fake();
        f.calls.push({ op: 'jobs.post', input });
        f.posted.push(input);
        const id = 'WM-' + String(500 + f.posted.length);
        f.jobs[id] = { state: 'posted', translatorHandle: null, updatedAt: '2026-04-10T08:00:00Z', wordCount: input.wordCount };
        return { id, ...f.jobs[id] };
      },
      get: async (id) => {
        const f = fake();
        f.calls.push({ op: 'jobs.get', id });
        const job = f.jobs[id];
        if (job === undefined) throw new WordmarketApiError('not_found', 'No job ' + id);
        return { id, state: job.state, wordCount: job.wordCount, translatorHandle: job.translatorHandle, updatedAt: job.updatedAt };
      },
    };
  }
}
module.exports = { Wordmarket, WordmarketApiError };
