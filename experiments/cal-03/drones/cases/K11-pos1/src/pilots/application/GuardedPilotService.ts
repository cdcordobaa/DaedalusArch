import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class GuardedPilotService {
  private readonly busy = new Set<string>();

  constructor(private readonly pilots: PilotRepository) {}

  assign(pilotId: string, surveyId: string, hours: number): void {
    if (this.busy.has(pilotId)) {
      throw new Error('pilot is being updated');
    }
    this.busy.add(pilotId);
    try {
      const pilot = this.pilots.findById(pilotId);
      if (!pilot) {
        throw new Error('unknown pilot');
      }
      pilot.assign(surveyId, hours);
      this.pilots.save(pilot);
    } finally {
      this.busy.delete(pilotId);
    }
  }
}
