'use strict';
// F15 runtime stand-in for the SMS provider SDK whose typings the seed carries (src/types/textwave-sdk.d.ts).
// Tests drive it through globalThis.__textwaveFake = { submit(message), deliveryReport(messageSid), calls }.
// A fake answer { error: 'THROTTLED', retryAfterSeconds }, { error: 'BLOCKED', blockReason } or { error: 'UNAVAILABLE' }
// is thrown as the matching SDK error.
class TextwaveThrottledError extends Error {
  constructor(message, retryAfterSeconds) { super(message); this.name = 'TextwaveThrottledError'; this.retryAfterSeconds = retryAfterSeconds; }
}
class TextwaveRecipientBlockedError extends Error {
  constructor(message, blockReason) { super(message); this.name = 'TextwaveRecipientBlockedError'; this.blockReason = blockReason; }
}
class TextwaveUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'TextwaveUnavailableError'; }
}
function fake() {
  const f = globalThis.__textwaveFake;
  if (f === undefined) throw new Error('textwave-sdk stand-in: no globalThis.__textwaveFake');
  return f;
}
function answer(r) {
  if (r !== null && typeof r === 'object' && typeof r.error === 'string') {
    if (r.error === 'THROTTLED') throw new TextwaveThrottledError('textwave: too many requests', r.retryAfterSeconds);
    if (r.error === 'BLOCKED') throw new TextwaveRecipientBlockedError(`textwave: recipient blocked (${r.blockReason})`, r.blockReason);
    throw new TextwaveUnavailableError('textwave is unavailable');
  }
  return r;
}
class TextwaveClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('textwave: apiKey required');
    this.apiKey = options.apiKey;
  }
  async submit(message) {
    const f = fake();
    f.calls.push({ op: 'submit', request: message, at: Date.now() });
    return answer(f.submit(message));
  }
  async deliveryReport(messageSid) {
    const f = fake();
    f.calls.push({ op: 'deliveryReport', request: messageSid, at: Date.now() });
    return answer(f.deliveryReport(messageSid));
  }
}
module.exports = { TextwaveClient, TextwaveThrottledError, TextwaveRecipientBlockedError, TextwaveUnavailableError };
