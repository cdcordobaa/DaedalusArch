import { PrismaService } from '../../persistence/PrismaService';

export interface Discrepancy {
  binCode: string;
  delta: number;
}

export class CycleCountService {
  constructor(private readonly prisma: PrismaService) {}

  async count(binCode: string, counted: number, expected: number): Promise<Discrepancy | null> {
    await this.prisma.stockCount.create({ data: { id: `${binCode}@${Date.now()}`, binCode, counted, expected, countedAt: new Date() } });
    return counted === expected ? null : { binCode, delta: counted - expected };
  }

  async openDiscrepancies(): Promise<Discrepancy[]> {
    const rows = await this.prisma.stockCount.findMany();
    return rows.filter((r) => r.counted !== r.expected).map((r) => ({ binCode: r.binCode, delta: r.counted - r.expected }));
  }
}
