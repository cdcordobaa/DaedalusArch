import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { MarketDate } from '../../shared-kernel/MarketDate';
import type { NoticeQueue } from '../application/ports/NoticeQueue';
import { MarketDay, type MarketDaySnapshot } from '../domain/day/MarketDay';
import type { MarketDayRepository } from '../domain/day/MarketDayRepository';

/** Market days and their pending notices side by side: storing a day queues its notices in the same step. */
export class InMemoryMarketDayStore implements MarketDayRepository, NoticeQueue {
  private readonly days = new Map<string, MarketDaySnapshot>();
  private queued: DomainEvent[] = [];
  private refs = 0;

  forDate(date: MarketDate): MarketDay | undefined {
    const s = this.days.get(date.iso);
    return s === undefined ? undefined : MarketDay.fromSnapshot(s);
  }

  issueRef(): string {
    this.refs += 1;
    return `BK-${String(this.refs).padStart(3, '0')}`;
  }

  store(day: MarketDay): void {
    const notices = day.takeNotices();
    this.days.set(day.date.iso, day.snapshot());
    this.queued = [...this.queued, ...notices];
  }

  drain(): DomainEvent[] {
    const out = this.queued;
    this.queued = [];
    return out;
  }
}
