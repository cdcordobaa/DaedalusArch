import { Worker } from 'bullmq';
import { Kafka } from 'kafkajs';
// AS3 (consumer half): a top-level worker, owned by the file.
export const worker = new Worker('restock', async () => undefined);

const consumer = new Kafka({ clientId: 'reports', brokers: [] }).consumer({ groupId: 'reports' });
// AS4 (consumer half).
export async function startConsumer(): Promise<void> {
  await consumer.subscribe({ topics: ['invoice.issued'] });
}
