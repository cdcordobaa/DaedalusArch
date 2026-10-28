import type { LibraryEvent } from '../../shared-kernel/LibraryEvent';
import type { PendingEvents } from '../application/ports/PendingEvents';
import type { LotShelf } from '../domain/lot/LotShelf';
import { SeedLot, type LogEntry, type LotSnapshot } from '../domain/lot/SeedLot';
import { LotNumber } from '../domain/lot/values/LotNumber';

/** Lots and their unsent events in one place: keeping a lot queues its events in the same step. */
export class MemoryShelf implements LotShelf, PendingEvents {
  private readonly lots = new Map<string, LotSnapshot>();
  private readonly logs = new Map<string, LogEntry[]>();
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

  logOf(number: LotNumber): LogEntry[] {
    return [...(this.logs.get(number.text) ?? [])];
  }

  private append(number: string, entries: LogEntry[]): void {
    this.logs.set(number, [...(this.logs.get(number) ?? []), ...entries]);
  }

  keep(lot: SeedLot): void {
    const raised = lot.takeUnsent();
    this.append(lot.number.text, lot.takeUnlogged());
    this.lots.set(lot.number.text, lot.snapshot());
    this.queue.push(...raised);
  }

  keepAll(lots: SeedLot[]): void {
    const kept = lots.map((lot) => ({ raised: lot.takeUnsent(), entries: lot.takeUnlogged(), snap: lot.snapshot() }));
    kept.forEach(({ snap, entries }) => {
      this.lots.set(snap.number, snap);
      this.append(snap.number, entries);
    });
    kept.forEach(({ raised }) => this.queue.push(...raised));
  }

  drain(): LibraryEvent[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
