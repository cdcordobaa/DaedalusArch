import { Kafka } from 'kafkajs';
const kafka = new Kafka({ clientId: 'billing', brokers: ['localhost:9092'] });
const producer = kafka.producer();
// AS4: kafkajs topic 'invoice.issued' (subscriber: reports).
export async function publishInvoice(id: string): Promise<void> {
  await producer.send({ topic: 'invoice.issued', messages: [{ value: id }] });
}
