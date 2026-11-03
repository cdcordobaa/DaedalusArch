import { type PartOrderResponse } from 'bowcraft-sdk';
import { JobNotFoundError } from '../domain/errors';
import { OrderPartsCommand, OrderPartsPort, OrderPartsResult } from './ports/in/order-parts.port';
import { JobRepositoryPort } from './ports/out/job-repository.port';
import { OwnerNotifierPort } from './ports/out/owner-notifier.port';
import { PartsSupplierPort } from './ports/out/parts-supplier.port';

export class OrderPartsUseCase implements OrderPartsPort {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly supplier: PartsSupplierPort,
    private readonly notifier: OwnerNotifierPort,
  ) {}

  async order(command: OrderPartsCommand): Promise<OrderPartsResult> {
    const job = await this.jobs.findById(command.jobId);
    if (job === null) throw new JobNotFoundError(command.jobId);
    const ticket = await this.supplier.order({ partSku: job.partSku, timber: job.timber, quantity: 1 });
    job.awaitParts(ticket);
    await this.jobs.save(job);
    await this.notifier.notify(job.ownerId, job.id, job.currentStatus);
    return { jobId: job.id, status: job.currentStatus };
  }

  describe(raw: PartOrderResponse): string {
    return `${raw.order_ref} due ${raw.eta_date}`;
  }
}
