import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Lot } from './Lot';

export interface LotStore {
  newId(): string;
  find(id: string): Lot | undefined;
  /** Writes the lot and appends the events of the change to the outbox, in one step. */
  openLotsLedBy(bidderId: string): string[];
  save(lot: Lot, events?: readonly DomainEvent[]): void;
}
