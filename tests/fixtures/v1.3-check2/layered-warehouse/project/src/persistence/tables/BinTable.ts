import { PrismaService } from '../PrismaService';

export interface BinData {
  code: string;
  sku: string | null;
  quantity: number;
  maxWeightGrams: number;
}

export class BinTable {
  constructor(private readonly prisma: PrismaService) {}

  find(code: string): Promise<BinData | null> {
    return this.prisma.bin.findUnique({ where: { code } });
  }

  holding(sku: string): Promise<BinData[]> {
    return this.prisma.bin.findMany({ where: { sku } });
  }

  async store(bin: BinData): Promise<void> {
    await this.prisma.bin.update({ where: { code: bin.code }, data: { sku: bin.sku, quantity: bin.quantity } });
  }
}
