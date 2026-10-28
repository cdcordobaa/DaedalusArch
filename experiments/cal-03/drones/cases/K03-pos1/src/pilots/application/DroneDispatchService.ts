import type { DroneRepository } from '../domain/drone/DroneRepository';
import type { PilotRepository } from '../domain/pilot/PilotRepository';

export class DroneDispatchService {
  constructor(
    private readonly pilots: PilotRepository,
    private readonly drones: DroneRepository,
  ) {}

  dispatch(pilotId: string, droneId: string): void {
    const pilot = this.pilots.findById(pilotId);
    const drone = this.drones.findById(droneId);
    if (!pilot || !drone) {
      throw new Error('unknown pilot or drone');
    }
    pilot.preferDrone(droneId);
    drone.checkOut();
    this.pilots.save(pilot);
    this.drones.save(drone);
  }
}
