import { JobController } from './adapters/in/http/job.controller';
import { BowcraftConsignmentHandler } from './adapters/in/webhook/bowcraft-consignment.handler';
import { ConsoleOwnerNotifier } from './adapters/out/notification/console-owner-notifier';
import { InMemoryJobRepository } from './adapters/out/persistence/in-memory-job.repository';
import { BowcraftPartsAdapter } from './domain/suppliers/bowcraft-parts.adapter';
import { OrderPartsUseCase } from './application/order-parts.use-case';
import { RecordDeliveryUseCase } from './application/record-delivery.use-case';

const jobs = new InMemoryJobRepository();
const notifier = new ConsoleOwnerNotifier();
const orderParts = new OrderPartsUseCase(jobs, new BowcraftPartsAdapter('demo-key'), notifier);
const recordDelivery = new RecordDeliveryUseCase(jobs, notifier);

export const jobController = new JobController(orderParts);
export const bowcraftConsignments = new BowcraftConsignmentHandler(recordDelivery);
