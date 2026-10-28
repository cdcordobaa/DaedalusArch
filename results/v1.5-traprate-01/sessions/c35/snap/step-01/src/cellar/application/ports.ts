import type { CellarEvent } from '../domain/events';

/** Facts kept with the change that raised them, waiting to be handed to the reactions. */
export interface Mailbox {
  post(facts: readonly CellarEvent[]): void;
  collect(): CellarEvent[];
}

/** The goods-in book at the cellar door. */
export interface ReceivingLog {
  write(line: string): void;
  lines(): string[];
}
