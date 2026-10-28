import { ScooterUnavailableError } from '../domain/errors';
import { LockScooterPort } from './ports/in/lock-scooter.port';
import { NotificationSenderPort } from './ports/out/notification-sender.port';
import { ScooterRepositoryPort } from './ports/out/scooter-repository.port';

export class LockScooterUseCase implements LockScooterPort {
  constructor(private readonly scooters: ScooterRepositoryPort, private readonly notifier: NotificationSenderPort) {}
  async lock(scooterId: string, batteryPercent: number): Promise<void> {
    const scooter = await this.scooters.find(scooterId);
    if (!scooter) throw new ScooterUnavailableError(scooterId);
    scooter.lock(batteryPercent);
    await this.scooters.save(scooter);
    if (scooter.currentState === 'needs-swap') await this.notifier.send('ops', `Swap battery on ${scooter.id}`);
  }
}
