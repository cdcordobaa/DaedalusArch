import { Scooter } from '../../../domain/scooter';
export interface ScooterRepositoryPort {
  save(scooter: Scooter): Promise<void>;
  find(id: string): Promise<Scooter | undefined>;
}
