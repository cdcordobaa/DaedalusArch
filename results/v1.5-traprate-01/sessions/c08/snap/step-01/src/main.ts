import { batchCommands, type LotUse } from './cellar/application/batchCommands';
import { logReceipt } from './cellar/application/logReceipt';
import { lotCommands } from './cellar/application/lotCommands';
import { readings } from './cellar/application/readings';
import { createRelay } from './cellar/application/relay';
import { memoryBatchStore } from './cellar/infrastructure/MemoryBatchStore';
import { memoryLotStore } from './cellar/infrastructure/MemoryLotStore';
import { memoryMailbox } from './cellar/infrastructure/MemoryMailbox';
import { memoryReceivingLog } from './cellar/infrastructure/MemoryReceivingLog';

export interface BreweryOptions {
  /** Today's date as YYYY-MM-DD; defaults to the system date. */
  readonly today?: () => string;
}

/** Composition root. Each command hands its kept facts to their reactions before it returns. */
export function createApp(options: BreweryOptions = {}) {
  const today = options.today ?? ((): string => new Date().toISOString().slice(0, 10));
  const mailbox = memoryMailbox();
  const lots = memoryLotStore(mailbox);
  const batches = memoryBatchStore(mailbox);
  const goodsIn = memoryReceivingLog();
  const relay = createRelay(mailbox);
  relay.when('lot-received', logReceipt(goodsIn));

  const lot = lotCommands({ lots, today });
  const batch = batchCommands({ batches, lots, today });
  const read = readings({ lots, batches });
  const delivered = <T>(command: () => T): T => {
    const result = command();
    relay.flush();
    return result;
  };

  return {
    receiveLot: (ingredient: string, kg: number, bestBefore: string): string => delivered(() => lot.receive(ingredient, kg, bestBefore)),
    writeOff: (lotId: string, kg: number): void => delivered(() => lot.writeOff(lotId, kg)),
    planBatch: (beer: string, fermentationDays: number): string => delivered(() => batch.plan(beer, fermentationDays)),
    brew: (batchId: string, uses: readonly LotUse[]): void => delivered(() => batch.brew(batchId, uses)),
    lotStock: (lotId: string): number => read.lotStock(lotId),
    batchStatus: (batchId: string): string => read.batchStatus(batchId),
    receivingLog: (): string[] => goodsIn.lines(),
  };
}
