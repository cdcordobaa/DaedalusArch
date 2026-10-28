import type { PilotRepository } from '../domain/pilot/PilotRepository';
import type { PilotDto } from '../contracts/PilotDto';

export class PilotRosterQuery {
  constructor(private readonly pilots: PilotRepository) {}

  roster(): PilotDto[] {
    return this.pilots.findAll().map((pilot) => ({
      id: pilot.id,
      name: pilot.name,
      licenceNo: pilot.licenceNo,
      weeklyHourCap: pilot.weeklyHourCap,
      assignedHours: pilot.assignedHours,
      preferredDroneId: pilot.preferredDroneId,
    }));
  }
}
