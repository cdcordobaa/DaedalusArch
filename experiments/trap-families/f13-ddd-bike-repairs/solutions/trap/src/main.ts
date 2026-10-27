import { ApproveOverrun } from './workshop/application/ApproveOverrun';
import { BookJob } from './workshop/application/BookJob';
import { CompleteJob } from './workshop/application/CompleteJob';
import { EventRelay } from './workshop/application/EventRelay';
import { GetJob, type JobView } from './workshop/application/GetJob';
import { GetStock } from './workshop/application/GetStock';
import { LogLabour } from './workshop/application/LogLabour';
import { ReceiveParts } from './workshop/application/ReceiveParts';
import { SendBookingNotice } from './workshop/application/SendBookingNotice';
import { MAIN_STOCKROOM, Stockroom } from './workshop/domain/stock/Stockroom';
import { InMemoryJobRepository } from './workshop/infrastructure/InMemoryJobRepository';
import { InMemoryNotices } from './workshop/infrastructure/InMemoryNotices';
import { InMemoryOutbox } from './workshop/infrastructure/InMemoryOutbox';
import { Sku } from './workshop/domain/stock/value-objects/Sku';
import { InMemoryStockroomRepository } from './workshop/infrastructure/InMemoryStockroomRepository';

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp() {
  const outbox = new InMemoryOutbox();
  const jobs = new InMemoryJobRepository(outbox);
  const stockrooms = new InMemoryStockroomRepository(outbox);
  stockrooms.save(Stockroom.open(MAIN_STOCKROOM));
  const notices = new InMemoryNotices();
  const relay = new EventRelay(outbox);
  const booking = new SendBookingNotice(notices);
  relay.on('JobBooked', (e) => booking.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    bookJob: (customer: string, bike: string): string => command(() => new BookJob(jobs).execute(customer, bike)),
    logLabour: (jobId: string, hours: number): void => command(() => new LogLabour(jobs).execute(jobId, hours)),
    receiveParts: (sku: string, quantity: number): void => command(() => new ReceiveParts(stockrooms).execute(sku, quantity)),
    completeJob: (jobId: string, parts: { sku: string; quantity: number }[]): void => command(() => new CompleteJob(jobs, stockrooms).execute(jobId, parts)),
    approveOverrun: (jobId: string): void => command(() => new ApproveOverrun(jobs).execute(jobId)),
    job: (jobId: string): JobView => new GetJob(jobs).execute(jobId),
    stockOf: (sku: string): number => new GetStock(stockrooms).execute(sku),
    stockHistory: (sku: string) =>
      (stockrooms.byId(MAIN_STOCKROOM)?.history(Sku.of(sku)) ?? []).map((m) => ({ kind: m.kind, quantity: m.quantity, jobId: m.jobId })),
    notices: (): string[] => notices.all(),
  };
}
