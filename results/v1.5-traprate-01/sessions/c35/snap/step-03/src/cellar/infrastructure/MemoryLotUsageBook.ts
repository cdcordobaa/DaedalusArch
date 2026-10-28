import type { LotUsageBook } from '../application/ports';

export function memoryLotUsageBook(): LotUsageBook {
  const rows: { lotId: string; batchId: string; grams: number }[] = [];
  return {
    add: (lotId, batchId, grams) => { rows.push({ lotId, batchId, grams }); },
    entriesFor: (lotId) => rows.filter((row) => row.lotId === lotId).map(({ batchId, grams }) => ({ batchId, grams })),
  };
}
