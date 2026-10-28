import { Drone } from '../domain/drone/Drone';
import type { DroneRepository } from '../domain/drone/DroneRepository';
import type { DroneDto, RegisterDroneCommand } from '../contracts/PilotDto';

export class DroneService {
  constructor(private readonly drones: DroneRepository) {}

  registerDrone(cmd: RegisterDroneCommand): string {
    const drone = Drone.register(this.drones.nextId(), cmd.model, cmd.maxFlightMinutes);
    this.drones.save(drone);
    return drone.id;
  }

  sendToMaintenance(droneId: string): void {
    const drone = this.load(droneId);
    drone.sendToMaintenance();
    this.drones.save(drone);
  }

  getDrone(droneId: string): DroneDto {
    const drone = this.load(droneId);
    return { id: drone.id, model: drone.model, status: drone.status };
  }

  private load(id: string): Drone {
    const drone = this.drones.findById(id);
    if (!drone) {
      throw new Error(`drone ${id} not found`);
    }
    return drone;
  }
}
