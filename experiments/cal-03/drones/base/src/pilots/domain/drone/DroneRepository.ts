import type { Drone } from './Drone';

export interface DroneRepository {
  nextId(): string;
  save(drone: Drone): void;
  findById(id: string): Drone | undefined;
}
