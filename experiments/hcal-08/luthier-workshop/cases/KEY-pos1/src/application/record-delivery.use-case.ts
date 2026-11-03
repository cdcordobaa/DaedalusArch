import { JobNotFoundError } from '../domain/errors';
import { DeliveryStage } from '../domain/supply';
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
    job.partsUpdate(this.stageOf(command.fulfilment));
    await this.jobs.save(job);
    await this.notifier.notify(job.ownerId, job.id, job.currentStatus);
  }

  private stageOf(fulfilment: string): DeliveryStage {
    if (fulfilment === 'HANDED') return 'delivered';
    else if (fulfilment === 'VOIDED') return 'cancelled';
    else if (fulfilment === 'FREIGHTED' || fulfilment === 'CRATED') return 'in-transit';
    return 'preparing';
  }
}
