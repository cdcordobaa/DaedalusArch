'use strict';
// F23 runtime stand-in for the vendor SDK whose typings the seed carries (src/types/inkwell-sdk.d.ts). Tests drive it
// through globalThis.__inkwellFake = { calls, account(), createEnvelope(draft), getEnvelope(id), sendReminder(id, req) };
// a hook may answer { error: '<InkwellErrorCode>', recipientEmail? } to make the SDK throw an InkwellError.
// Callback signatures: header 't=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the webhook secret>'.
const crypto = require('node:crypto');

class InkwellError extends Error {
  constructor(message, errorCode, recipientEmail) {
    super(message);
    this.name = 'InkwellError';
    this.errorCode = errorCode;
    if (recipientEmail !== undefined) this.recipientEmail = recipientEmail;
  }
}
class InkwellSignatureError extends Error {
  constructor(message) { super(message); this.name = 'InkwellSignatureError'; }
}
function fake() {
  const f = globalThis.__inkwellFake;
  if (f === undefined) throw new Error('inkwell-sdk stand-in: no globalThis.__inkwellFake');
  return f;
}
function answer(result) {
  if (result !== null && typeof result === 'object' && typeof result.error === 'string') {
    throw new InkwellError(`inkwell: ${result.error}`, result.error, result.recipientEmail);
  }
  return result;
}

const HANDLERS = {
  'recipient.declined': 'onRecipientDeclined',
  'recipient.viewed': 'onRecipientViewed',
  'envelope.expired': 'onEnvelopeExpired',
  'envelope.completed': 'onEnvelopeCompleted',
};
class InkwellWebhooks {
  constructor(secret) { this.secret = secret; }
  parse(rawBody, signatureHeader) {
    if (typeof this.secret !== 'string' || this.secret === '') throw new Error('inkwell: webhookSecret required to check callbacks');
    const parts = Object.fromEntries(String(signatureHeader ?? '').split(',').map((p) => p.split('=')));
    const expected = crypto.createHmac('sha256', this.secret).update(`${parts.t}.${rawBody}`).digest('hex');
    if (parts.t === undefined || parts.v1 !== expected) throw new InkwellSignatureError('inkwell: callback signature does not match');
    return JSON.parse(rawBody);
  }
  async dispatch(rawBody, signatureHeader, handlers) {
    const event = this.parse(rawBody, signatureHeader);
    const name = HANDLERS[event.eventType];
    if (name !== undefined && handlers !== undefined && typeof handlers[name] === 'function') await handlers[name](event);
  }
}

class InkwellClient {
  constructor(options) {
    if (options === undefined || typeof options.apiKey !== 'string' || options.apiKey === '') throw new Error('inkwell: apiKey required');
    this.apiKey = options.apiKey;
    this.webhooks = new InkwellWebhooks(options.webhookSecret);
  }
  async account() {
    const f = fake();
    f.calls.push({ op: 'account' });
    return answer(f.account());
  }
  async createEnvelope(draft) {
    const f = fake();
    f.calls.push({ op: 'createEnvelope', request: draft });
    return answer(f.createEnvelope(draft));
  }
  async getEnvelope(envelopeId) {
    const f = fake();
    f.calls.push({ op: 'getEnvelope', request: envelopeId });
    return answer(f.getEnvelope(envelopeId));
  }
  async sendReminder(envelopeId, request) {
    const f = fake();
    f.calls.push({ op: 'sendReminder', request: { envelopeId, ...request } });
    return answer(f.sendReminder(envelopeId, request));
  }
}
module.exports = { InkwellClient, InkwellError, InkwellSignatureError, InkwellWebhooks };
