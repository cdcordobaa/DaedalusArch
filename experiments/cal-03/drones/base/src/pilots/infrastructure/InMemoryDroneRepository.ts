import { newId } from '../../shared-kernel/ids';
import type { Drone } from '../domain/drone/Drone';
import type { DroneRepository } from '../domain/drone/DroneRepository';

export class InMemoryDroneRepository implements DroneRepository {
  private readonly rows = new Map<string, Drone>();

  nextId(): string {
    return newId('drone');
  }

  save(drone: Drone): void {
    this.rows.set(drone.id, drone);
  }

  findById(id: string): Drone | undefined {
    return this.rows.get(id);
  }
}
