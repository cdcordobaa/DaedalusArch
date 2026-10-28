import type { Happening } from '../shared-kernel/happening';

/** An append-only list of happenings, read by position. */
export interface Journal {
  readFrom(position: number): readonly Happening[];
}

export type Reactions = Readonly<Record<string, (h: Happening) => void>>;

/**
 * Reads every journal from where it last stopped and hands each new happening to the reactions that asked for its
 * kind. A reaction may write new happenings; the mailroom keeps reading until no journal has anything new.
 */
export class Mailroom {
  private readonly cursors: number[];
  private readonly listeners: Reactions[] = [];

  constructor(private readonly journals: readonly Journal[]) {
    this.cursors = journals.map(() => 0);
  }

  subscribe(reactions: Reactions): void {
    this.listeners.push(reactions);
  }

  drain(): void {
    for (;;) {
      const fresh: Happening[] = [];
      this.journals.forEach((j, i) => {
        const items = j.readFrom(this.cursors[i]!);
        this.cursors[i] = this.cursors[i]! + items.length;
        fresh.push(...items);
      });
      if (fresh.length === 0) return;
      for (const h of fresh) for (const r of this.listeners) r[h.kind]?.(h);
    }
  }
}
