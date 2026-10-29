'use strict';
// TRAP-PILOT-v2 P5 runtime stand-in for the email SDK whose typings the seed carries (src/types/postbird-sdk.d.ts).
// Tests drive it through globalThis.__postbirdFake = { sent: [message], refuse: [address], calls: [] }.
class PostbirdError extends Error {
  constructor(message) { super(message); this.name = 'PostbirdError'; }
}
function fake() {
  const f = globalThis.__postbirdFake;
  if (f === undefined) throw new Error('postbird-sdk stand-in: no globalThis.__postbirdFake');
  return f;
}
class PostbirdClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('postbird: apiKey required');
    this.apiKey = options.apiKey;
  }
  async sendTemplate(message) {
    const f = fake();
    f.calls.push({ op: 'sendTemplate', message });
    f.sent.push(message);
    return { messageId: 'm' + String(f.sent.length), state: f.refuse.includes(message.to) ? 'rejected' : 'queued' };
  }
}
module.exports = { PostbirdClient, PostbirdError };
