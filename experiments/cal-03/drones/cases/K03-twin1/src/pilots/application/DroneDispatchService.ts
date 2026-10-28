import type { DroneRepository } from '../domain/drone/DroneRepository';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class DroneDispatchService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly drones: DroneRepository,
  ) {}

  dispatch(pilotId: string, droneId: string): void {
    const pilot = this.pilots.findById(pilotId);
    if (!pilot) {
      throw new Error('unknown pilot');
    }
    pilot.preferDrone(droneId);
    this.pilots.save(pilot);
  }

  checkOut(droneId: string): void {
    const drone = this.drones.findById(droneId);
    if (!drone) {
      throw new Error('unknown drone');
    }
    drone.checkOut();
    this.drones.save(drone);
  }
}
