import type { MarketDate } from '../../../shared-kernel/MarketDate';
import type { MarketDay } from './MarketDay';

export interface MarketDayRepository {
  forDate(date: MarketDate): MarketDay | undefined;
  issueRef(): string;
  /** Stores the day together with the notices it raised, in one step. */
  store(day: MarketDay): void;
}
