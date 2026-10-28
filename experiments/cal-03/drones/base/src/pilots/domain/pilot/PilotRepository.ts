import type { Pilot } from './Pilot';

export interface PilotRepository {
  nextId(): string;
  save(pilot: Pilot): void;
  findById(id: string): Pilot | undefined;
  findAll(): Pilot[];
}
