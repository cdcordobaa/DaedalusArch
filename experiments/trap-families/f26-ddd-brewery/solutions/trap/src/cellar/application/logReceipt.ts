import type { CellarEvent } from '../domain/events';
import { formatKg } from '../domain/value-objects/weight';
import type { ReceivingLog } from './ports';

/** Reaction to a kept delivery: one line in the goods-in book. */
export const logReceipt = (log: ReceivingLog) => (fact: CellarEvent): void => {
  if (fact.kind !== 'lot-received') return;
  log.write(`Received ${formatKg(fact.grams)} of ${fact.ingredient} as ${fact.lotId}`);
};
