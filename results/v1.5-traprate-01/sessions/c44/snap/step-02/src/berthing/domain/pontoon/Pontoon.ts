import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { BerthingError } from '../BerthingError';
import { PontoonAdded, PontoonClosed } from './events';
import { Berth } from './value-objects/Berth';

export interface PontoonRecord {
  readonly id: string;
  readonly name: string;
  readonly berthLengthsM: readonly number[];
  /** Occupant by berth number. */
  readonly occupants: Readonly<Record<number, string>>;
  readonly closed?: boolean;
}

/** A floating jetty with numbered berths. A berth has at most one occupant, and a boat only goes where it fits. */
export class Pontoon {
  private recorded: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly name: string,
    private readonly berths: readonly Berth[],
    private occupants: Map<number, string>,
    private closed = false,
  ) {}

  static add(id: string, name: string, berthLengthsM: readonly number[]): Pontoon {
    if (name.trim() === '') throw new BerthingError('a pontoon needs a name');
    if (berthLengthsM.length === 0) throw new BerthingError('a pontoon needs at least one berth');
    const berths = berthLengthsM.map((l, i) => Berth.of(i + 1, l));
    const pontoon = new Pontoon(id, name, berths, new Map());
    pontoon.recorded.push(new PontoonAdded(id, name, [...berthLengthsM]));
    return pontoon;
  }

  static fromRecord(r: PontoonRecord): Pontoon {
    const berths = r.berthLengthsM.map((l, i) => Berth.of(i + 1, l));
    return new Pontoon(r.id, r.name, berths, new Map(Object.entries(r.occupants).map(([n, o]) => [Number(n), o])), r.closed ?? false);
  }

  toRecord(): PontoonRecord {
    return { id: this.id, name: this.name, berthLengthsM: this.berths.map((b) => b.lengthM), occupants: Object.fromEntries(this.occupants), closed: this.closed };
  }

  berthCount(): number {
    return this.berths.length;
  }

  freeBerths(): number {
    return this.berths.length - this.occupants.size;
  }

  /** Gives the occupant the shortest free berth the boat fits (the lower number on a tie) and returns it. */
  moor(occupant: string, boatLengthM: number): Berth {
    const best = this.tryMoor(occupant, boatLengthM);
    if (best === undefined) throw new BerthingError(`no free berth fits ${String(boatLengthM)} m`);
    return best;
  }

  /** Like moor, but answers undefined instead of throwing when no free berth fits. */
  tryMoor(occupant: string, boatLengthM: number): Berth | undefined {
    if (!Number.isFinite(boatLengthM) || boatLengthM <= 0) throw new BerthingError('a boat length must be a positive number of metres');
    if ([...this.occupants.values()].includes(occupant)) throw new BerthingError(`${occupant} already has a berth on ${this.name}`);
    if (this.closed) return undefined;
    const best = this.berths
      .filter((b) => !this.occupants.has(b.number) && b.takes(boatLengthM))
      .sort((a, b) => a.lengthM - b.lengthM || a.number - b.number)[0];
    if (best === undefined) return undefined;
    this.occupants = new Map([...this.occupants, [best.number, occupant]]);
    return best;
  }

  unmoor(occupant: string): void {
    const held = [...this.occupants].find(([, o]) => o === occupant);
    if (held === undefined) throw new BerthingError(`no berth is held by ${occupant}`);
    const next = new Map(this.occupants);
    next.delete(held[0]);
    this.occupants = next;
  }

  /** Closed for a storm; closing again changes nothing. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.recorded.push(new PontoonClosed(this.id));
  }

  drainRecorded(): DomainEvent[] {
    const out = this.recorded;
    this.recorded = [];
    return out;
  }
}
