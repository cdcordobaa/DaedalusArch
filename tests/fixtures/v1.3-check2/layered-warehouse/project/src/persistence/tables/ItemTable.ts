import { PrismaService } from '../PrismaService';

export interface ItemData {
  sku: string;
  description: string;
  unitWeightGrams: number;
  reorderLevel: number;
}

export class ItemTable {
  constructor(private readonly prisma: PrismaService) {}

  find(sku: string): Promise<ItemData | null> {
    return this.prisma.item.findUnique({ where: { sku } });
  }
}
