import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PilotUtilizationReport {
  constructor(private readonly pilots: PilotRepository) {}

  utilization(): number {
    const pilots = this.pilots.findAll();
    const assigned = pilots.reduce((sum, p) => sum + p.assignedHours, 0);
    const capacity = pilots.reduce((sum, p) => sum + p.weeklyHourCap, 0);
    return capacity === 0 ? 0 : assigned / capacity;
  }
}
