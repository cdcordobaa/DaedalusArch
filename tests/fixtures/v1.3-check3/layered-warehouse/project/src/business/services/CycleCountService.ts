import { StockCountTable } from '../../persistence/tables/StockCountTable';

export interface Discrepancy {
  binCode: string;
  delta: number;
}

export class CycleCountService {
  constructor(private readonly counts: StockCountTable) {}

  async count(binCode: string, counted: number, expected: number): Promise<Discrepancy | null> {
    await this.counts.insert({ id: `${binCode}@${Date.now()}`, binCode, counted, expected, countedAt: new Date() });
    return counted === expected ? null : { binCode, delta: counted - expected };
  }

  async openDiscrepancies(): Promise<Discrepancy[]> {
    const rows = await this.counts.all();
    return rows.filter((r) => r.counted !== r.expected).map((r) => ({ binCode: r.binCode, delta: r.counted - r.expected }));
  }
}
