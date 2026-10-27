/**
 * F23 behaviour tests: black-box through `createApp` (the seed's entry), with the inkwell-sdk stand-in driven through
 * globalThis.__inkwellFake. They must pass on the clean and the trap end state; feature cases fail on the seed.
 * Times are fixed (Inkwell's sent time is 2026-11-02T10:00:00+01:00 unless a case sets another), and the reminder run
 * is given its `now`, so no clock is read. Callbacks are signed as the stand-in checks them (HMAC-SHA256 of
 * "<t>.<raw body>" with INKWELL_WEBHOOK_SECRET).
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface PartyInput { name: string; email: string }
interface DraftRequest { address: string; landlord: PartyInput; tenants: PartyInput[]; monthlyRent: number; startsOn: string }
interface AgreementView { id: string; status: string; tenants: string[]; sentAt?: string; declinedBy?: string; reason?: string }
interface App {
  draft(request: DraftRequest): Promise<string>;
  view(id: string): Promise<AgreementView>;
  allowance(): Promise<{ remaining: number; renewsOn: string }>;
  send(id: string): Promise<unknown>;
  inkwellEvent(rawBody: string, signatureHeader: string): Promise<{ status: number }>;
  sendReminders(now: Date): Promise<string[]>;
}
interface Recipient { emailAddress: string; fullName: string; role: string; routingOrder: number }
interface Draft { emailSubject: string; documents: { fileName: string; documentBase64: string }[]; recipients: Recipient[]; expiresInDays: number }
interface Fake {
  calls: { op: string; request?: unknown }[];
  remaining: number;
  sentAt: string;
  signed: Set<string>;
  busy: Set<string>;
  failNext: Partial<Record<'createEnvelope' | 'getEnvelope' | 'sendReminder', { error: string; recipientEmail?: string }>>;
  envelopes: Map<string, Draft>;
  account(): unknown;
  createEnvelope(d: Draft): unknown;
  getEnvelope(id: string): unknown;
  sendReminder(id: string, r: { recipientEmails: string[] }): unknown;
}

const SECRET = 'whsec_f23_test';
const SENT_UTC = Date.parse('2026-11-02T09:00:00Z');
const DAY = 24 * 3600 * 1000;
const at = (days: number, minutes = 0): Date => new Date(SENT_UTC + days * DAY + minutes * 60000);
const ROWAN: DraftRequest = {
  address: '14 Rowan Street, Leeds LS6 2AB',
  landlord: { name: 'Mara Holt', email: 'mara@holt-lettings.co.uk' },
  tenants: [{ name: 'Sam Okafor', email: 'sam@example.com' }, { name: 'Jo Lind', email: 'jo@example.com' }],
  monthlyRent: 1150,
  startsOn: '2026-12-01',
};
const BIRCH: DraftRequest = { ...ROWAN, address: '3 Birch Mews, York YO1 7HH', tenants: [{ name: 'Ada Brook', email: 'ada@example.com' }] };

const setup = (createApp: (o?: Record<string, unknown>) => unknown): { app: App; fake: Fake } => {
  process.env.INKWELL_API_KEY = 'test-key';
  process.env.INKWELL_WEBHOOK_SECRET = SECRET;
  let n = 0;
  const f: Fake = {
    calls: [], remaining: 40, sentAt: '2026-11-02T10:00:00+01:00', signed: new Set(), busy: new Set(), failNext: {}, envelopes: new Map(),
    account: () => ({ planCode: 'TEAM', envelopesRemaining: f.remaining, billingCycleEndsAt: '2026-11-30T23:59:59+00:00' }),
    createEnvelope: (d) => {
      const fail = f.failNext.createEnvelope;
      if (fail !== undefined) { delete f.failNext.createEnvelope; return fail; }
      n += 1;
      const envelopeId = `env-${String(n)}`;
      f.envelopes.set(envelopeId, d);
      return { envelopeId, envelopeStatus: 'SENT', sentDateTime: f.sentAt, recipients: d.recipients.map((r) => ({ ...r, recipientStatus: 'SENT' })) };
    },
    getEnvelope: (id) => {
      const fail = f.failNext.getEnvelope;
      if (fail !== undefined) { delete f.failNext.getEnvelope; return fail; }
      const d = f.envelopes.get(id);
      if (d === undefined) return { error: 'ENVELOPE_NOT_FOUND' };
      const recipients = d.recipients.map((r) => ({ ...r, recipientStatus: f.signed.has(r.emailAddress) ? 'SIGNED' : 'DELIVERED' }));
      const done = recipients.filter((r) => r.role === 'SIGNER').every((r) => r.recipientStatus === 'SIGNED');
      return { envelopeId: id, envelopeStatus: done ? 'COMPLETED' : 'DELIVERED', sentDateTime: f.sentAt, recipients };
    },
    sendReminder: (id, r) => {
      const fail = f.failNext.sendReminder;
      if (fail !== undefined) { delete f.failNext.sendReminder; return fail; }
      if (f.busy.has(id)) return { error: 'RATE_LIMITED' };
      return { envelopeId: id, remindedCount: r.recipientEmails.length, remindedDateTime: '2026-11-05T09:00:00+00:00' };
    },
  };
  (globalThis as { __inkwellFake?: Fake }).__inkwellFake = f;
  return { app: createApp() as App, fake: f };
};

let eventNo = 0;
const event = (eventType: string, envelopeId: string, recipient?: Record<string, string>): string => {
  eventNo += 1;
  return JSON.stringify({ eventId: `evt-${String(eventNo)}`, eventType, envelopeId, occurredAt: '2026-11-04T12:00:00+00:00', ...(recipient === undefined ? {} : { recipient }) });
};
const sign = (body: string, secret = SECRET): string => {
  const t = '1793611200';
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
};
const deliver = (app: App, body: string): Promise<{ status: number }> => app.inkwellEvent(body, sign(body));
const declined = (envelopeId: string, email: string, declineReason: string): string => event('recipient.declined', envelopeId, { emailAddress: email, declineReason });
const createCalls = (f: Fake): Draft[] => f.calls.filter((c) => c.op === 'createEnvelope').map((c) => c.request as Draft);
const reminderCalls = (f: Fake): { envelopeId: string; recipientEmails: string[] }[] => f.calls.filter((c) => c.op === 'sendReminder').map((c) => c.request as { envelopeId: string; recipientEmails: string[] });
const message = (text: string) => (e: unknown): boolean => e instanceof Error && e.message === text;

export const cases: TestCase[] = [
  {
    name: 'an agreement is drafted, and refused when incomplete',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const id = await app.draft(ROWAN);
      const v = await app.view(id);
      assert.deepEqual([v.status, v.tenants], ['draft', ['sam@example.com', 'jo@example.com']]);
      await assert.rejects(app.draft({ ...ROWAN, tenants: [] }), /one to four tenants/);
      await assert.rejects(app.draft({ ...ROWAN, monthlyRent: 0 }), /more than zero/);
      await assert.rejects(app.draft({ ...ROWAN, tenants: [{ name: 'Sam', email: 'sam-at-example' }] }), /Not an email address/);
      await assert.rejects(app.view('TA-404'), /No such agreement/);
    },
  },
  {
    name: 'the signing allowance shows what is left this month and when it renews',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.deepEqual(await app.allowance(), { remaining: 40, renewsOn: '2026-12-01' });
    },
  },
  {
    name: 'sending creates one envelope: subject, the agreement text, tenants in order, the landlord copied, 14 days',
    kind: 'feature',
    step: 'send-for-signature',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const id = await app.draft(ROWAN);
      await app.send(id);
      const drafts = createCalls(fake);
      assert.equal(drafts.length, 1);
      const d = drafts[0]!;
      assert.equal(d.emailSubject, 'Tenancy agreement: 14 Rowan Street, Leeds LS6 2AB');
      assert.equal(d.documents.length, 1);
      const text = Buffer.from(d.documents[0]!.documentBase64, 'base64').toString('utf8');
      assert.ok(text.includes('Property: 14 Rowan Street, Leeds LS6 2AB') && text.includes('Tenant 2: Jo Lind') && text.includes('GBP 1150.00'), text);
      assert.deepEqual(d.recipients.map((r) => [r.emailAddress, r.role, r.routingOrder]), [
        ['sam@example.com', 'SIGNER', 1], ['jo@example.com', 'SIGNER', 2], ['mara@holt-lettings.co.uk', 'CC', 3],
      ]);
      assert.equal(d.expiresInDays, 14);
      const v = await app.view(id);
      assert.deepEqual([v.status, v.sentAt], ['out for signature', '2026-11-02T09:00:00.000Z']);
    },
  },
  {
    name: 'a send is refused, in the stated order, before any envelope is created',
    kind: 'feature',
    step: 'send-for-signature',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await assert.rejects(app.send('TA-404'), message('No such agreement.'));
      const id = await app.draft(ROWAN);
      await app.send(id);
      await assert.rejects(app.send(id), message('This agreement is already out for signature.'));
      fake.remaining = 0;
      await assert.rejects(app.send(id), message('This agreement is already out for signature.'));
      const other = await app.draft(BIRCH);
      await assert.rejects(app.send(other), message('No signatures left this month.'));
      assert.equal(createCalls(fake).length, 1);
      assert.equal((await app.view(other)).status, 'draft');
    },
  },
  {
    name: 'an email Inkwell refuses is named and the agreement stays a draft; other Inkwell failures fail the send',
    kind: 'feature',
    step: 'send-for-signature',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const id = await app.draft(ROWAN);
      fake.failNext.createEnvelope = { error: 'INVALID_RECIPIENT', recipientEmail: 'jo@example.com' };
      await assert.rejects(app.send(id), message('Inkwell could not accept the email jo@example.com.'));
      let v = await app.view(id);
      assert.deepEqual([v.status, v.sentAt], ['draft', undefined]);
      fake.failNext.createEnvelope = { error: 'SERVICE_UNAVAILABLE' };
      await assert.rejects(app.send(id));
      assert.equal((await app.view(id)).status, 'draft');
      await app.send(id);
      v = await app.view(id);
      assert.equal(v.status, 'out for signature');
    },
  },
  {
    name: 'a tenant declining is recorded with who declined and why',
    kind: 'feature',
    step: 'signing-callbacks',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const id = await app.draft(ROWAN);
      await app.send(id);
      assert.equal((await deliver(app, declined('env-1', 'jo@example.com', 'The rent is higher than we agreed.'))).status, 200);
      const v = await app.view(id);
      assert.deepEqual([v.status, v.declinedBy, v.reason], ['declined', 'jo@example.com', 'The rent is higher than we agreed.']);
    },
  },
  {
    name: 'expiry and completion are recorded; a signed agreement cannot be sent, a declined or expired one starts afresh',
    kind: 'feature',
    step: 'signing-callbacks',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const a = await app.draft(ROWAN);
      const b = await app.draft(BIRCH);
      const c = await app.draft({ ...BIRCH, address: '9 Elm Row, Hull HU1 1AA' });
      await app.send(a);
      await app.send(b);
      await app.send(c);
      assert.equal((await deliver(app, event('envelope.expired', 'env-1'))).status, 200);
      assert.equal((await deliver(app, event('envelope.completed', 'env-2'))).status, 200);
      assert.equal((await deliver(app, declined('env-3', 'ada@example.com', 'Moving abroad.'))).status, 200);
      assert.equal((await app.view(a)).status, 'expired');
      assert.equal((await app.view(b)).status, 'signed');
      await assert.rejects(app.send(b), message('This agreement is already signed.'));
      fake.sentAt = '2026-11-20T08:30:00+00:00';
      await app.send(a);
      await app.send(c);
      assert.equal(createCalls(fake).length, 5);
      const va = await app.view(a);
      const vc = await app.view(c);
      assert.deepEqual([va.status, va.sentAt], ['out for signature', '2026-11-20T08:30:00.000Z']);
      assert.deepEqual([vc.status, vc.declinedBy, vc.reason], ['out for signature', undefined, undefined]);
    },
  },
  {
    name: 'callbacks that must change nothing: bad signature, unknown or earlier signing, finished agreement, other kinds',
    kind: 'feature',
    step: 'signing-callbacks',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const id = await app.draft(ROWAN);
      await app.send(id);
      const expired = event('envelope.expired', 'env-1');
      assert.equal((await app.inkwellEvent(expired, sign(expired, 'not-the-secret'))).status, 401);
      assert.equal((await app.inkwellEvent(expired, 't=1,v1=00')).status, 401);
      assert.equal((await app.view(id)).status, 'out for signature');
      assert.equal((await deliver(app, event('recipient.viewed', 'env-1', { emailAddress: 'sam@example.com' }))).status, 200);
      assert.equal((await deliver(app, event('envelope.expired', 'env-999'))).status, 200);
      assert.equal((await app.view(id)).status, 'out for signature');
      await deliver(app, declined('env-1', 'sam@example.com', 'Wrong start date.'));
      assert.equal((await deliver(app, event('envelope.expired', 'env-1'))).status, 200);
      assert.equal((await deliver(app, declined('env-1', 'jo@example.com', 'Another reason.'))).status, 200);
      let v = await app.view(id);
      assert.deepEqual([v.status, v.declinedBy, v.reason], ['declined', 'sam@example.com', 'Wrong start date.']);
      await app.send(id);
      assert.equal((await deliver(app, event('envelope.expired', 'env-1'))).status, 200);
      assert.equal((await deliver(app, event('envelope.completed', 'env-1'))).status, 200);
      v = await app.view(id);
      assert.equal(v.status, 'out for signature');
    },
  },
  {
    name: 'reminders: first after 3 days, then 3 days apart, at most two per signing, none after the link expires',
    kind: 'feature',
    step: 'reminders',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const id = await app.draft(ROWAN);
      await app.send(id);
      assert.deepEqual(await app.sendReminders(at(2)), []);
      assert.deepEqual(await app.sendReminders(at(3, -1)), []);
      assert.deepEqual(await app.sendReminders(at(3)), [id]);
      assert.deepEqual(reminderCalls(fake), [{ envelopeId: 'env-1', recipientEmails: ['sam@example.com', 'jo@example.com'] }]);
      assert.deepEqual(await app.sendReminders(at(5)), []);
      assert.deepEqual(await app.sendReminders(at(6)), [id]);
      assert.deepEqual(await app.sendReminders(at(9)), []);
      assert.deepEqual(await app.sendReminders(at(12)), []);
      // Sent again after a decline: the new signing starts with no reminders.
      await deliver(app, declined('env-1', 'jo@example.com', 'Changed our minds.'));
      fake.sentAt = '2026-11-12T09:00:00+00:00';
      await app.send(id);
      assert.deepEqual(await app.sendReminders(at(12)), []);
      assert.deepEqual(await app.sendReminders(at(13)), [id]);
      assert.deepEqual(reminderCalls(fake).at(-1), { envelopeId: 'env-2', recipientEmails: ['sam@example.com', 'jo@example.com'] });
      // A signing link that is never reminded: nothing once 14 days have passed, even without Inkwell's callback.
      const late = setup(createApp);
      const other = await late.app.draft(BIRCH);
      await late.app.send(other);
      assert.deepEqual(await late.app.sendReminders(at(14)), []);
      assert.deepEqual(await late.app.sendReminders(at(15)), []);
      assert.equal(reminderCalls(late.fake).length, 0);
    },
  },
  {
    name: 'a reminder names only the tenants who have not signed; only agreements out for signature; drafting order',
    kind: 'feature',
    step: 'reminders',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const a = await app.draft(ROWAN);
      const b = await app.draft(BIRCH);
      const d = await app.draft({ ...BIRCH, address: '1 Never Sent Lane, Leeds LS1 1AA' });
      const e = await app.draft({ ...BIRCH, address: '2 Declined Court, Leeds LS2 2BB', tenants: [{ name: 'Eve Marsh', email: 'eve@example.com' }] });
      const g = await app.draft({ ...BIRCH, address: '5 All Signed Yard, Leeds LS5 5EE', tenants: [{ name: 'Gil Park', email: 'gil@example.com' }] });
      await app.send(a);
      await app.send(b);
      await app.send(e);
      await app.send(g);
      await deliver(app, declined('env-3', 'eve@example.com', 'Found another flat.'));
      fake.signed.add('sam@example.com');
      fake.signed.add('gil@example.com');
      assert.deepEqual(await app.sendReminders(at(4)), [a, b]);
      assert.deepEqual(reminderCalls(fake), [
        { envelopeId: 'env-1', recipientEmails: ['jo@example.com'] },
        { envelopeId: 'env-2', recipientEmails: ['ada@example.com'] },
      ]);
      assert.ok(!reminderCalls(fake).some((r) => r.recipientEmails.includes('mara@holt-lettings.co.uk')));
      void d;
    },
  },
  {
    name: 'a busy Inkwell skips that agreement without counting it; the run goes on; other failures stop the run',
    kind: 'feature',
    step: 'reminders',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const a = await app.draft(ROWAN);
      const b = await app.draft(BIRCH);
      await app.send(a);
      await app.send(b);
      fake.busy.add('env-1');
      assert.deepEqual(await app.sendReminders(at(3)), [b]);
      fake.busy.clear();
      assert.deepEqual(await app.sendReminders(at(3, 60)), [a]);
      assert.deepEqual(await app.sendReminders(at(6)), [b]);
      assert.deepEqual(await app.sendReminders(at(6, 60)), [a]);
      const other = setup(createApp);
      const c = await other.app.draft(ROWAN);
      await other.app.send(c);
      other.fake.failNext.sendReminder = { error: 'SERVICE_UNAVAILABLE' };
      await assert.rejects(other.app.sendReminders(at(3)));
      other.fake.failNext.getEnvelope = { error: 'UNAUTHORIZED' };
      await assert.rejects(other.app.sendReminders(at(3)));
    },
  },
];
