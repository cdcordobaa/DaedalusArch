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

export function reschedule(rehearsal: Rehearsal, newStart: Date, now: Date): void {
  if (rehearsal.cancelled) throw new Error('a cancelled rehearsal cannot be moved');
  if (newStart.getTime() <= now.getTime()) throw new Error('a rehearsal can only be moved to a future date');
  rehearsal.startsAt = newStart;
}
