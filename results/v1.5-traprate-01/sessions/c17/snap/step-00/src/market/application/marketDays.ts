import { MarketDate } from '../../shared-kernel/MarketDate';
import { MarketDay } from '../domain/day/MarketDay';
import type { MarketDayRepository } from '../domain/day/MarketDayRepository';
import { Pitch } from '../domain/day/value-objects/Pitch';

export interface PitchLayout {
  readonly code: string;
  readonly kind: string;
}

export function openMarketDay(days: MarketDayRepository, date: string, layout: readonly PitchLayout[]): void {
  const on = MarketDate.parse(date);
  if (days.forDate(on) !== undefined) throw new Error(`the market is already open on ${date}`);
  days.store(MarketDay.open(on, layout.map((p) => Pitch.of(p.code, p.kind))));
}

export function dayOf(days: MarketDayRepository, date: string): MarketDay {
  const day = days.forDate(MarketDate.parse(date));
  if (day === undefined) throw new Error(`no market day ${date}`);
  return day;
}
