import type { DroneRepository } from '../domain/drone/DroneRepository';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class PreferredDroneService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly drones: DroneRepository,
  ) {}

  prefer(pilotId: string, droneId: string): void {
    const pilot = this.pilots.findById(pilotId);
    const drone = this.drones.findById(droneId);
    if (!pilot || !drone) {
      throw new Error('unknown pilot or drone');
    }
    if (drone.status === 'maintenance') {
      throw new Error('cannot prefer a drone in maintenance');
    }
    pilot.preferDrone(droneId);
    this.pilots.save(pilot);
  }
}
