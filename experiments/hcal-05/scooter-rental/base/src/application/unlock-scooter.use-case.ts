import { ScooterUnavailableError } from '../domain/errors';
import { UnlockScooterPort } from './ports/in/unlock-scooter.port';
import { ScooterRepositoryPort } from './ports/out/scooter-repository.port';

export class UnlockScooterUseCase implements UnlockScooterPort {
  constructor(private readonly scooters: ScooterRepositoryPort) {}
  async unlock(scooterId: string): Promise<void> {
    const scooter = await this.scooters.find(scooterId);
    if (!scooter) throw new ScooterUnavailableError(scooterId);
    scooter.unlock();
    await this.scooters.save(scooter);
  }
}
