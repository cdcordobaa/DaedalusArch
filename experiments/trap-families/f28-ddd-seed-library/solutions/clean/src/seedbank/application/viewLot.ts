import type { LogEntry } from '../domain/lot/LogEntry';
import type { LotShelf } from '../domain/lot/LotShelf';
import { requireLot } from './lookup';

export interface LotView {
  readonly number: string;
  readonly variety: string;
  readonly garden: string;
  readonly grams: number;
  readonly germination: number;
  readonly intake: string;
  readonly cameFrom: string | null;
}

export function viewLot(shelf: LotShelf, number: string): LotView {
  const { log: _log, ...view } = requireLot(shelf, number).snapshot();
  return view;
}

export function lotsAt(shelf: LotShelf, garden: string): string[] {
  return shelf.atGarden(garden).map((lot) => lot.number.text);
}

export function lotLog(shelf: LotShelf, number: string): LogEntry[] {
  return requireLot(shelf, number).log();
}
