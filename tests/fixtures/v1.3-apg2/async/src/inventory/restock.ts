import { Queue } from 'bullmq';
const queue = new Queue('restock');
// AS3: bullmq queue 'restock' (consumer: reports' Worker).
export async function requestRestock(sku: string): Promise<void> {
  await queue.add('restock', { sku });
}
