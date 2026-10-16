import { BookController } from '../adapters/inbound/http/BookController';
import { LoanController } from '../adapters/inbound/http/LoanController';
import { MemberController } from '../adapters/inbound/http/MemberController';
import { ReportController } from '../adapters/inbound/http/ReportController';
import { ConsoleNotifier } from '../adapters/outbound/notifications/ConsoleNotifier';
import { InMemoryReminderLog } from '../adapters/outbound/notifications/InMemoryReminderLog';
import { InMemoryBookRepository } from '../adapters/outbound/persistence/InMemoryBookRepository';
import { InMemoryLoanRepository } from '../adapters/outbound/persistence/InMemoryLoanRepository';
import { InMemoryMemberRepository } from '../adapters/outbound/persistence/InMemoryMemberRepository';
import { SystemClock } from '../adapters/outbound/time/SystemClock';
import { OverdueReminderJob } from '../adapters/scheduled/OverdueReminderJob';
import { ListBooksUseCase } from '../application/catalog/ListBooksUseCase';
import { RegisterBookUseCase } from '../application/catalog/RegisterBookUseCase';
import { LendBookUseCase } from '../application/lending/LendBookUseCase';
import { ListMemberLoansUseCase } from '../application/lending/ListMemberLoansUseCase';
import { ReturnBookUseCase } from '../application/lending/ReturnBookUseCase';
import { GetMemberUseCase } from '../application/membership/GetMemberUseCase';
import { RegisterMemberUseCase } from '../application/membership/RegisterMemberUseCase';
import type { Clock } from '../application/ports/Clock';
import type { Notifier } from '../application/ports/Notifier';
import { SendOverdueRemindersUseCase } from '../application/reminders/SendOverdueRemindersUseCase';
import { OverdueReportUseCase } from '../application/reporting/OverdueReportUseCase';

/** Composition root: the only place that instantiates adapters. */
export function createContainer(clock: Clock = new SystemClock(), notifier: Notifier = new ConsoleNotifier()) {
  const books = new InMemoryBookRepository();
  const members = new InMemoryMemberRepository();
  const loans = new InMemoryLoanRepository();
  const overdueReport = new OverdueReportUseCase(loans, books, members, clock);
  return {
    bookController: new BookController(new RegisterBookUseCase(books), new ListBooksUseCase(books)),
    memberController: new MemberController(new RegisterMemberUseCase(members), new GetMemberUseCase(members)),
    loanController: new LoanController(
      new LendBookUseCase(books, members, loans, clock),
      new ReturnBookUseCase(loans, clock),
      new ListMemberLoansUseCase(loans),
    ),
    reportController: new ReportController(overdueReport),
    overdueReminderJob: new OverdueReminderJob(
      new SendOverdueRemindersUseCase(overdueReport, notifier, new InMemoryReminderLog()),
      clock,
    ),
  };
}

export type Container = ReturnType<typeof createContainer>;
