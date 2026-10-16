import type { Section } from './singer';

export interface Rehearsal {
  readonly id: string;
  readonly sections: readonly Section[];
  startsAt: Date;
  readonly venue: string;
  cancelled: boolean;
  readonly attended: Set<string>;
}

export function involves(rehearsal: Rehearsal, section: Section): boolean {
  return rehearsal.sections.includes(section);
}

/** The singer's section's last two held rehearsals up to and including `latest`, both without the singer. */
export function missedTwoInARow(history: readonly Rehearsal[], latest: Rehearsal, singerId: string, section: Section): boolean {
  const held = history
    .filter((r) => !r.cancelled && involves(r, section) && r.startsAt.getTime() <= latest.startsAt.getTime())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 2);
  return held.length === 2 && held.every((r) => !r.attended.has(singerId));
}
