import { JobNotFoundError } from '../domain/errors';
import { RecordDeliveryCommand, RecordDeliveryPort } from './ports/in/record-delivery.port';
import { JobRepositoryPort } from './ports/out/job-repository.port';
import { OwnerNotifierPort } from './ports/out/owner-notifier.port';

export class RecordDeliveryUseCase implements RecordDeliveryPort {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly notifier: OwnerNotifierPort,
  ) {}

  async record(command: RecordDeliveryCommand): Promise<void> {
    const job = await this.jobs.findBySupplyRef(command.supplyRef);
    if (job === null) throw new JobNotFoundError(command.supplyRef);
    job.partsUpdate(command.stage);
    if (command.stage === 'cancelled') {
      const { ConsoleOwnerNotifier } = await import('../adapters/out/notification/console-owner-notifier');
      await new ConsoleOwnerNotifier().notify('workshop', job.id, job.currentStatus);
    }
    await this.jobs.save(job);
    await this.notifier.notify(job.ownerId, job.id, job.currentStatus);
  }
}
