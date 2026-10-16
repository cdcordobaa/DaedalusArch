import { PrismaService } from '../PrismaService';

export interface StockCountData {
  id: string;
  binCode: string;
  counted: number;
  expected: number;
  countedAt: Date;
}

export class StockCountTable {
  constructor(private readonly prisma: PrismaService) {}

  async insert(row: StockCountData): Promise<void> {
    await this.prisma.stockCount.create({ data: row });
  }

  all(): Promise<StockCountData[]> {
    return this.prisma.stockCount.findMany();
  }
}
