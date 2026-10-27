import type { LibraryEvent } from '../../shared-kernel/LibraryEvent';
import type { PendingEvents } from '../application/ports/PendingEvents';
import type { LotShelf } from '../domain/lot/LotShelf';
import { SeedLot, type LotSnapshot } from '../domain/lot/SeedLot';
import { LotNumber } from '../domain/lot/values/LotNumber';

/** Lots and their unsent events in one place: keeping a lot queues its events in the same step. */
export class MemoryShelf implements LotShelf, PendingEvents {
  private readonly lots = new Map<string, LotSnapshot>();
  private queue: LibraryEvent[] = [];
  private issued = 0;

  nextNumber(): LotNumber {
    this.issued += 1;
    return LotNumber.of(`L-${String(this.issued).padStart(4, '0')}`);
  }

  find(number: LotNumber): SeedLot | undefined {
    const snap = this.lots.get(number.text);
    return snap && SeedLot.fromSnapshot(snap);
  }

  atGarden(garden: string): SeedLot[] {
    return [...this.lots.values()].filter((s) => s.garden === garden).map((s) => SeedLot.fromSnapshot(s));
  }

  keep(lot: SeedLot): void {
    const raised = lot.takeUnsent();
    this.lots.set(lot.number.text, lot.snapshot());
    this.queue.push(...raised);
  }

  drain(): LibraryEvent[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
