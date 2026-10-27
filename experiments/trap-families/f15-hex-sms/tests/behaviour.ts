/**
 * F15 behaviour tests: black-box through `createApp` (the seed's entry), with the textwave-sdk stand-in driven through
 * globalThis.__textwaveFake. They must pass on the clean and the trap end state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface BookingView { appointmentId: string; confirmation: string }
interface ReminderResult { appointmentId: string; status: string }
interface ReminderLine { appointmentId: string; patientName: string; phone: string; time: string; reminder: string; callPatient?: boolean }
interface App {
  book(patientName: string, phone: string, day: string, time: string): Promise<BookingView>;
  sendReminders(day: string): Promise<ReminderResult[]>;
  reminderReport(day: string): Promise<ReminderLine[]>;
}
interface Message { to: string; from: string; body: string }
interface Call { op: string; request: unknown; at: number }
interface Fake { calls: Call[]; submit: (m: Message) => unknown; deliveryReport: (sid: string) => unknown; accepted: { sid: string; message: Message }[] }

const DAY = '2026-11-03';
const NEXT = '2026-11-04';
const ANA = '+31612345678';
const BEN = '+31687654321';
const CAS = '+447700900123';
const DIA = '+4915112345678';

let counter = 0;
const ok = (m: Message): unknown => ({ messageSid: `SM-${m.to}-${String(++counter)}`, segments: 1 });
const throttled = (seconds: number): unknown => ({ error: 'THROTTLED', retryAfterSeconds: seconds });
const blocked = (reason: string): unknown => ({ error: 'BLOCKED', blockReason: reason });
const isReminder = (m: Message): boolean => m.body.includes('reminder');

const setup = (createApp: (o?: Record<string, unknown>) => unknown, fake: Partial<Fake> = {}): { app: App; fake: Fake } => {
  process.env.TEXTWAVE_API_KEY = 'test-key';
  const f: Fake = { calls: [], submit: ok, deliveryReport: (sid) => ({ messageSid: sid, deliveryState: 'ACCEPTED' }), ...fake, accepted: [] };
  const answer = f.submit;
  f.submit = (m) => {
    const r = answer(m) as { messageSid?: string };
    if (typeof r.messageSid === 'string') f.accepted.push({ sid: r.messageSid, message: m });
    return r;
  };
  (globalThis as { __textwaveFake?: Fake }).__textwaveFake = f;
  return { app: createApp() as App, fake: f };
};
const submits = (f: Fake): Message[] => f.calls.filter((c) => c.op === 'submit').map((c) => c.request as Message);
const reminderCalls = (f: Fake, to: string): Call[] => f.calls.filter((c) => c.op === 'submit' && (c.request as Message).to === to && isReminder(c.request as Message));
const sidsOf = (f: Fake, reminders: boolean): string[] => f.accepted.filter((a) => isReminder(a.message) === reminders).map((a) => a.sid);
const reportsAsked = (f: Fake): string[] => f.calls.filter((c) => c.op === 'deliveryReport').map((c) => c.request as string);
const statuses = (rs: ReminderResult[]): string[][] => rs.map((r) => [r.appointmentId, r.status]);
const line = async (app: App, day: string, id: string): Promise<[string, boolean | undefined]> => {
  const l = (await app.reminderReport(day)).find((x) => x.appointmentId === id);
  assert.ok(l !== undefined, `${id} is on the list of ${day}`);
  return [l.reminder, l.callPatient];
};

export const cases: TestCase[] = [
  {
    name: 'a booking is confirmed to the patient by text',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const v = await app.book('Ana Smit', '+31 6 1234 5678', DAY, '09:30');
      assert.deepEqual([v.appointmentId, v.confirmation], ['APT-1', 'sent']);
      assert.deepEqual(submits(fake), [{ to: ANA, from: 'NORTHSIDE', body: 'Northside Clinic: your appointment is booked for 2026-11-03 at 09:30.' }]);
    },
  },
  {
    name: 'a badly formed booking is refused before any text is sent',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await assert.rejects(app.book('Ana Smit', '0612345678', DAY, '09:30'), /international form/);
      await assert.rejects(app.book('Ana Smit', ANA, '3 Nov', '09:30'), /YYYY-MM-DD/);
      await assert.rejects(app.book('Ana Smit', ANA, DAY, '9.30'), /HH:MM/);
      assert.equal(submits(fake).length, 0);
    },
  },
  {
    name: 'reminders go out once for the appointments of the day',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await app.book('Ana Smit', ANA, DAY, '09:30');
      await app.book('Ben Mol', BEN, NEXT, '10:00');
      await app.book('Cas Bell', CAS, DAY, '14:15');
      assert.deepEqual(statuses(await app.sendReminders(DAY)), [['APT-1', 'sent'], ['APT-3', 'sent']]);
      assert.deepEqual(reminderCalls(fake, ANA).map((c) => c.request), [{ to: ANA, from: 'NORTHSIDE', body: 'Northside Clinic: reminder of your appointment on 2026-11-03 at 09:30. Reply STOP to opt out.' }]);
      assert.deepEqual(await app.sendReminders(DAY), []);
      assert.equal(submits(fake).filter(isReminder).length, 2);
      const list = await app.reminderReport(DAY);
      assert.deepEqual(list.map((l) => [l.appointmentId, l.patientName, l.phone, l.time, l.reminder]), [['APT-1', 'Ana Smit', ANA, '09:30', 'sent'], ['APT-3', 'Cas Bell', CAS, '14:15', 'sent']]);
      assert.deepEqual((await app.reminderReport(NEXT)).map((l) => [l.appointmentId, l.reminder]), [['APT-2', 'not sent']]);
    },
  },
  {
    name: 'the front desk list shows what Textwave reports for each reminder',
    kind: 'feature',
    step: 'delivery-receipts',
    run: async (createApp) => {
      const state: Record<string, string> = { [ANA]: 'DELIVERED', [BEN]: 'UNDELIVERED', [CAS]: 'EXPIRED', [DIA]: 'ACCEPTED' };
      const { app, fake } = setup(createApp, {
        deliveryReport: (sid) => {
          const to = /^SM-(\+\d+)-/.exec(sid)?.[1] ?? '';
          return { messageSid: sid, deliveryState: state[to], ...(state[to] === 'UNDELIVERED' ? { handsetErrorCode: '30003' } : {}) };
        },
      });
      for (const [name, phone] of [['Ana Smit', ANA], ['Ben Mol', BEN], ['Cas Bell', CAS], ['Dia Roth', DIA]]) await app.book(name!, phone!, DAY, '09:00');
      await app.sendReminders(DAY);
      await app.book('Eva Lind', '+31600000001', DAY, '16:00');
      const list = await app.reminderReport(DAY);
      assert.deepEqual(list.map((l) => [l.appointmentId, l.reminder, l.callPatient]), [
        ['APT-1', 'delivered', false], ['APT-2', 'failed', true], ['APT-3', 'failed', true], ['APT-4', 'sent', false], ['APT-5', 'not sent', true],
      ]);
      assert.deepEqual(reportsAsked(fake), sidsOf(fake, true), 'one report per reminder sent, asked by its message id; none for confirmations or unsent reminders');
      assert.equal(sidsOf(fake, true).length, 4);
    },
  },
  {
    name: 'the front desk list uses the latest report each time it is shown',
    kind: 'feature',
    step: 'delivery-receipts',
    run: async (createApp) => {
      let state = 'ACCEPTED';
      const { app, fake } = setup(createApp, { deliveryReport: (sid) => ({ messageSid: sid, deliveryState: state }) });
      await app.book('Ana Smit', ANA, DAY, '09:30');
      await app.sendReminders(DAY);
      assert.deepEqual(await line(app, DAY, 'APT-1'), ['sent', false]);
      state = 'DELIVERED';
      assert.deepEqual(await line(app, DAY, 'APT-1'), ['delivered', false]);
      assert.deepEqual(reportsAsked(fake), [...sidsOf(fake, true), ...sidsOf(fake, true)], 'asked again, by the reminder\'s id only');
    },
  },
  {
    name: 'a throttled reminder is tried again after the wait Textwave asks for',
    kind: 'feature',
    step: 'throttling',
    run: async (createApp) => {
      let tries = 0;
      const { app, fake } = setup(createApp, {
        submit: (m) => (isReminder(m) && m.to === ANA && ++tries === 1 ? throttled(0.06) : ok(m)),
      });
      await app.book('Ana Smit', ANA, DAY, '09:30');
      await app.book('Ben Mol', BEN, DAY, '10:00');
      assert.deepEqual(statuses(await app.sendReminders(DAY)), [['APT-1', 'sent'], ['APT-2', 'sent']]);
      const ana = reminderCalls(fake, ANA);
      assert.equal(ana.length, 2);
      assert.ok(ana[1]!.at - ana[0]!.at >= 50, `waited ${String(ana[1]!.at - ana[0]!.at)} ms, Textwave asked for 60`);
      assert.equal(reminderCalls(fake, BEN).length, 1);
    },
  },
  {
    name: 'a reminder still throttled after three tries is not sent and the run goes on',
    kind: 'feature',
    step: 'throttling',
    run: async (createApp) => {
      let throttle = true;
      const { app, fake } = setup(createApp, { submit: (m) => (isReminder(m) && m.to === ANA && throttle ? throttled(0.001) : ok(m)) });
      await app.book('Ana Smit', ANA, DAY, '09:30');
      await app.book('Ben Mol', BEN, DAY, '10:00');
      assert.deepEqual(statuses(await app.sendReminders(DAY)), [['APT-1', 'not sent'], ['APT-2', 'sent']]);
      assert.equal(reminderCalls(fake, ANA).length, 3);
      assert.deepEqual(await line(app, DAY, 'APT-1'), ['not sent', true]);
      throttle = false;
      assert.deepEqual(statuses(await app.sendReminders(DAY)), [['APT-1', 'sent']]);
      const down = setup(createApp, { submit: (m) => (isReminder(m) ? { error: 'UNAVAILABLE' } : ok(m)) });
      await down.app.book('Cas Bell', CAS, DAY, '11:00');
      await assert.rejects(down.app.sendReminders(DAY));
      assert.equal(reminderCalls(down.fake, CAS).length, 1, 'other errors are not retried');
    },
  },
  {
    name: 'a patient who opted out is never texted again',
    kind: 'feature',
    step: 'opt-outs',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { submit: (m) => (isReminder(m) && m.to === ANA ? blocked('OPTED_OUT') : ok(m)) });
      await app.book('Ana Smit', '+31 6 1234 5678', DAY, '09:30');
      await app.book('Ana Smit', ANA, NEXT, '09:30');
      await app.book('Ben Mol', BEN, DAY, '10:00');
      assert.deepEqual(statuses(await app.sendReminders(DAY)), [['APT-1', 'opted out'], ['APT-3', 'sent']]);
      assert.equal(reminderCalls(fake, ANA).length, 1, 'an opt-out is not retried');
      assert.deepEqual(await line(app, DAY, 'APT-1'), ['opted out', true]);
      const before = submits(fake).length;
      assert.deepEqual(statuses(await app.sendReminders(NEXT)), [['APT-2', 'opted out']]);
      const later = await app.book('Ana Smit', '+3161 234 5678', '2026-11-05', '08:00');
      assert.equal(later.confirmation, 'opted out');
      assert.equal(submits(fake).length, before, 'no text at all to a number that opted out');
      assert.deepEqual(await line(app, '2026-11-05', later.appointmentId), ['opted out', true]);
    },
  },
  {
    name: 'a number the carrier blocks is not remembered, and refused confirmations keep the booking',
    kind: 'feature',
    step: 'opt-outs',
    run: async (createApp) => {
      let carrierBlocks = true;
      const { app, fake } = setup(createApp, {
        submit: (m) => {
          if (m.to === BEN && isReminder(m) && carrierBlocks) return blocked('CARRIER_BLOCKED');
          if (m.to === CAS && !isReminder(m)) return blocked('CARRIER_BLOCKED');
          if (m.to === DIA && !isReminder(m)) return blocked('OPTED_OUT');
          return ok(m);
        },
      });
      await app.book('Ben Mol', BEN, DAY, '10:00');
      await app.book('Ana Smit', ANA, DAY, '11:00');
      assert.deepEqual(statuses(await app.sendReminders(DAY)), [['APT-1', 'not sent'], ['APT-2', 'sent']]);
      assert.equal(reminderCalls(fake, BEN).length, 1, 'a carrier block is not retried in the same run');
      assert.deepEqual(await line(app, DAY, 'APT-1'), ['not sent', true]);
      carrierBlocks = false;
      assert.deepEqual(statuses(await app.sendReminders(DAY)), [['APT-1', 'sent']]);
      assert.equal((await app.book('Ben Mol', BEN, NEXT, '10:00')).confirmation, 'sent');
      const cas = await app.book('Cas Bell', CAS, NEXT, '12:00');
      assert.equal(cas.confirmation, 'not sent');
      const dia = await app.book('Dia Roth', DIA, NEXT, '13:00');
      assert.equal(dia.confirmation, 'opted out');
      const diaTexts = submits(fake).filter((m) => m.to === DIA).length;
      const results = await app.sendReminders(NEXT);
      assert.deepEqual(statuses(results), [['APT-3', 'sent'], [cas.appointmentId, 'sent'], [dia.appointmentId, 'opted out']]);
      assert.equal(submits(fake).filter((m) => m.to === DIA).length, diaTexts, 'an opt-out refused at booking is remembered');
      assert.deepEqual((await app.reminderReport(NEXT)).map((l) => l.appointmentId), ['APT-3', cas.appointmentId, dia.appointmentId], 'refused confirmations keep the booking');
    },
  },
];
