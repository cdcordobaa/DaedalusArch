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
