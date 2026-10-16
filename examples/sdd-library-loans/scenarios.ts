/**
 * The OpenSpec scenarios of openspec/specs/ as executable checks, through the inbound adapters only (the way a
 * client would use the service). A fixed clock makes the dated scenarios reproducible.
 *
 *   npx tsx examples/sdd-library-loans/scenarios.ts
 */
import { ConsoleNotifier } from './src/adapters/outbound/notifications/ConsoleNotifier';
import type { Clock } from './src/application/ports/Clock';
import { createContainer } from './src/config/container';

class FixedClock implements Clock {
  constructor(private at: Date) {}
  set(day: string): void {
    this.at = new Date(`${day}T00:00:00Z`);
  }
  now(): Date {
    return this.at;
  }
}

const results: { spec: string; scenario: string; ok: boolean; detail: string }[] = [];
function check(spec: string, scenario: string, ok: boolean, detail: unknown): void {
  results.push({ spec, scenario, ok, detail: JSON.stringify(detail) });
}

async function main(): Promise<number> {
  const clock = new FixedClock(new Date('2026-10-01T00:00:00Z'));
  const notifier = new ConsoleNotifier(() => undefined);
  const c = createContainer(clock, notifier);
  const post = (body: unknown) => ({ method: 'POST' as const, path: '', body });

  // book-catalog
  const r1 = await c.bookController.register(post({ isbn: '9780132350884', title: 'Clean Code', author: 'Robert C. Martin', copies: 2 }));
  check('book-catalog', 'Valid book is registered', r1.status === 201 && (r1.body as { copies: number }).copies === 2, r1);
  const r2 = await c.bookController.register(post({ isbn: '9780132350880', title: 'X', author: 'Y', copies: 1 }));
  check('book-catalog', 'Invalid ISBN is rejected', r2.status === 400 && (r2.body as { error: string }).error === 'INVALID_ISBN', r2);
  const r3 = await c.bookController.register(post({ isbn: '9780132350884', title: 'Clean Code', author: 'R', copies: 1 }));
  check('book-catalog', 'Duplicate ISBN is rejected', r3.status === 409, r3);
  await c.bookController.register(post({ isbn: '9780134757599', title: 'Refactoring', author: 'Martin Fowler', copies: 1 }));
  const list = await c.bookController.list({ method: 'GET', path: '/books' });
  const titles = (list.body as { title: string }[]).map((b) => b.title);
  check('book-catalog', 'Catalogue is listed by title', titles.join('|') === 'Clean Code|Refactoring', titles);

  // membership
  const m1 = await c.memberController.register(post({ name: 'Ada Lovelace', email: 'ada@example.org' }));
  const ada = m1.body as { id: string; borrowingLimit: number };
  check('membership', 'Member is registered', m1.status === 201 && ada.borrowingLimit === 3, m1);
  const m2 = await c.memberController.register(post({ name: 'Ada L', email: 'ADA@example.org' }));
  check('membership', 'Duplicate e-mail is rejected', m2.status === 409, m2);
  const m3 = await c.memberController.get({ method: 'GET', path: '', params: { id: 'm-999' } });
  check('membership', 'Unknown member', m3.status === 404, m3);

  // lending
  const l1 = await c.loanController.lend(post({ isbn: '9780132350884', memberId: ada.id }));
  const loan = l1.body as { id: string; dueAt: string };
  check('lending', 'Book is lent', l1.status === 201 && loan.dueAt === '2026-10-22', l1);
  const grace = (await c.memberController.register(post({ name: 'Grace Hopper', email: 'grace@example.org' }))).body as { id: string };
  const refactoring = await c.loanController.lend(post({ isbn: '9780134757599', memberId: grace.id }));
  const l2 = await c.loanController.lend(post({ isbn: '9780134757599', memberId: ada.id }));
  check('lending', 'No copy available', refactoring.status === 201 && (l2.body as { error: string }).error === 'NO_COPY_AVAILABLE', l2);
  for (const [isbn, title] of [['9780201633610', 'Design Patterns'], ['9780321125217', 'Domain-Driven Design'], ['9780135957059', 'The Pragmatic Programmer']]) {
    await c.bookController.register(post({ isbn, title, author: 'various', copies: 1 }));
  }
  await c.loanController.lend(post({ isbn: '9780201633610', memberId: ada.id }));
  await c.loanController.lend(post({ isbn: '9780321125217', memberId: ada.id }));
  const l3 = await c.loanController.lend(post({ isbn: '9780135957059', memberId: ada.id }));
  check('lending', 'Member at the limit', (l3.body as { error: string }).error === 'BORROWING_LIMIT', l3);
  clock.set('2026-10-10');
  const ret = await c.loanController.return({ method: 'POST', path: '', params: { id: (refactoring.body as { id: string }).id } });
  check('lending', 'Book is returned', ret.status === 200 && (ret.body as { returnedAt: string }).returnedAt === '2026-10-10', ret);
  const again = await c.loanController.return({ method: 'POST', path: '', params: { id: (refactoring.body as { id: string }).id } });
  check('lending', 'Loan returned twice', (again.body as { error: string }).error === 'ALREADY_RETURNED', again);
  const open = await c.loanController.listForMember({ method: 'GET', path: '', params: { id: grace.id } });
  check('lending', 'Open loans listed', (open.body as unknown[]).length === 0, open);

  // overdue-report (Ada's three loans are due 2026-10-22; Grace returned hers)
  const rep = await c.reportController.overdue({ method: 'GET', path: '', query: { asOf: '2026-10-30' } });
  const lines = rep.body as { isbn: string; daysLate: number }[];
  check('overdue-report', 'One overdue loan', lines.some((l) => l.isbn === '9780132350884' && l.daysLate === 8), lines);
  check('overdue-report', 'Returned loans are not reported', !lines.some((l) => l.isbn === '9780134757599'), lines);
  clock.set('2026-10-27');
  await c.loanController.return({ method: 'POST', path: '', params: { id: loan.id } });
  const l4 = await c.loanController.lend(post({ isbn: '9780132350884', memberId: grace.id }));
  const rep2 = await c.reportController.overdue({ method: 'GET', path: '', query: { asOf: '2026-11-27' } });
  const days = (rep2.body as { isbn: string; daysLate: number }[]).map((l) => l.daysLate);
  check('overdue-report', 'Oldest debt first', l4.status === 201 && days.length === 3 && days[0] === 36 && days[2] === 10, rep2.body);

  // overdue-reminders: Grace's Clean Code loan of 2026-10-27 is due 2026-11-17
  clock.set('2026-11-25');
  const before = notifier.sent.length;
  await c.overdueReminderJob.runOnce();
  const graceMails = () => notifier.sent.filter((m) => m.to === 'grace@example.org');
  check('overdue-reminders', 'First reminder', graceMails().length === 1 && /8 day\(s\) late/.test(graceMails()[0]?.body ?? '') && notifier.sent.length - before === 3, notifier.sent);
  clock.set('2026-11-28');
  await c.overdueReminderJob.runOnce();
  check('overdue-reminders', 'No second reminder within a week', graceMails().length === 1, graceMails());
  clock.set('2026-12-02');
  await c.overdueReminderJob.runOnce();
  check('overdue-reminders', 'Reminder again after a week', graceMails().length === 2, graceMails());

  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.spec}: ${r.scenario}${r.ok ? '' : `  ${r.detail}`}\n`);
  const failed = results.filter((r) => !r.ok).length;
  process.stdout.write(`${String(results.length - failed)}/${String(results.length)} scenarios pass\n`);
  return failed === 0 ? 0 : 1;
}

main().then((code) => {
  process.exitCode = code;
});
