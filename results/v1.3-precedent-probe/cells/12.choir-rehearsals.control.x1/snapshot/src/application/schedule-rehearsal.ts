import { randomUUID } from 'node:crypto';
import type { Rehearsal } from '../domain/rehearsal';
import type { RehearsalRepository } from '../domain/rehearsal-repository';
import type { Section } from '../domain/singer';

export class ScheduleRehearsal {
  constructor(private readonly rehearsals: RehearsalRepository) {}

  async execute(sections: readonly Section[], startsAt: Date, venue: string): Promise<Rehearsal> {
    if (sections.length === 0) throw new Error('a rehearsal needs at least one section');
    const rehearsal: Rehearsal = { id: randomUUID(), sections, startsAt, venue, cancelled: false, attended: new Set() };
    await this.rehearsals.save(rehearsal);
    return rehearsal;
  }
}
