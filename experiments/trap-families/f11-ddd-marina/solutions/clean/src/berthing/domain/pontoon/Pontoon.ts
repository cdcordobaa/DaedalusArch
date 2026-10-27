import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { BerthingError } from '../BerthingError';
import { BerthGranted, BerthRefused, PontoonAdded, PontoonClosed } from './events';
import { Berth } from './value-objects/Berth';

export interface PontoonRecord {
  readonly id: string;
  readonly name: string;
  readonly berthLengthsM: readonly number[];
  /** Occupant by berth number. */
  readonly occupants: Readonly<Record<number, string>>;
  readonly closed: boolean;
}

/**
 * A floating jetty with numbered berths. A berth has at most one occupant, and a boat only goes where it fits. A
 * pontoon closed for a storm gives no seasonal berths.
 */
export class Pontoon {
  private recorded: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly name: string,
    private readonly berths: readonly Berth[],
    private occupants: Map<number, string>,
    private closed: boolean,
  ) {}

  static add(id: string, name: string, berthLengthsM: readonly number[]): Pontoon {
    if (name.trim() === '') throw new BerthingError('a pontoon needs a name');
    if (berthLengthsM.length === 0) throw new BerthingError('a pontoon needs at least one berth');
    const berths = berthLengthsM.map((l, i) => Berth.of(i + 1, l));
    const pontoon = new Pontoon(id, name, berths, new Map(), false);
    pontoon.recorded.push(new PontoonAdded(id, name, [...berthLengthsM]));
    return pontoon;
  }

  static fromRecord(r: PontoonRecord): Pontoon {
    const berths = r.berthLengthsM.map((l, i) => Berth.of(i + 1, l));
    return new Pontoon(r.id, r.name, berths, new Map(Object.entries(r.occupants).map(([n, o]) => [Number(n), o])), r.closed);
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
    if (!Number.isFinite(boatLengthM) || boatLengthM <= 0) throw new BerthingError('a boat length must be a positive number of metres');
    if (this.holds(occupant)) throw new BerthingError(`${occupant} already has a berth on ${this.name}`);
    const best = this.bestFreeBerth(boatLengthM);
    if (best === undefined) throw new BerthingError(`no free berth fits ${String(boatLengthM)} m`);
    this.occupants = new Map([...this.occupants, [best.number, occupant]]);
    return best;
  }

  /**
   * Answers a member's seasonal contract: grants the best free berth, or refuses when the pontoon is closed or no free
   * berth fits. Never throws for a refusal; a member who already holds a berth here is answered once only.
   */
  allocateFor(memberId: string, boatLengthM: number): void {
    if (this.holds(memberId)) return;
    const best = this.closed ? undefined : this.bestFreeBerth(boatLengthM);
    if (best === undefined) {
      this.recorded.push(new BerthRefused(this.id, memberId));
      return;
    }
    this.occupants = new Map([...this.occupants, [best.number, memberId]]);
    this.recorded.push(new BerthGranted(this.id, memberId, best.number, best.lengthM));
  }

  /** Frees a member's berth; nothing to do when the member holds none here. */
  releaseFor(memberId: string): void {
    if (this.holds(memberId)) this.unmoor(memberId);
  }

  /** Closes the pontoon for a storm; closing it again changes nothing. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.recorded.push(new PontoonClosed(this.id, [...this.occupants.values()]));
  }

  unmoor(occupant: string): void {
    const held = [...this.occupants].find(([, o]) => o === occupant);
    if (held === undefined) throw new BerthingError(`no berth is held by ${occupant}`);
    const next = new Map(this.occupants);
    next.delete(held[0]);
    this.occupants = next;
  }

  private holds(occupant: string): boolean {
    return [...this.occupants.values()].includes(occupant);
  }

  /** The shortest free berth the boat fits, the lower number on a tie. */
  private bestFreeBerth(boatLengthM: number): Berth | undefined {
    return this.berths
      .filter((b) => !this.occupants.has(b.number) && b.takes(boatLengthM))
      .sort((a, b) => a.lengthM - b.lengthM || a.number - b.number)[0];
  }

  drainRecorded(): DomainEvent[] {
    const out = this.recorded;
    this.recorded = [];
    return out;
  }
}
