import type { DroneService } from '../application/DroneService';
import type { DroneDto, RegisterDroneCommand } from '../contracts/PilotDto';

export class DroneController {
  constructor(private readonly service: DroneService) {}

  register(body: RegisterDroneCommand): { id: string } {
    return { id: this.service.registerDrone(body) };
  }

  get(droneId: string): DroneDto {
    return this.service.getDrone(droneId);
  }
}
