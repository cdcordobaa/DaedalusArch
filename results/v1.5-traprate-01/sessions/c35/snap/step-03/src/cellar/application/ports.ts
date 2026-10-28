import type { CellarEvent } from '../domain/events';

/** Facts kept with the change that raised them, waiting to be handed to the reactions. */
export interface Mailbox {
  post(facts: readonly CellarEvent[]): void;
  collect(): CellarEvent[];
}

/** Where each lot went: one entry per lot use in a brew, in the order the brews happened. */
export interface LotUsageBook {
  add(lotId: string, batchId: string, grams: number): void;
  entriesFor(lotId: string): { batchId: string; grams: number }[];
}

/** The goods-in book at the cellar door. */
export interface ReceivingLog {
  write(line: string): void;
  lines(): string[];
}
