import { PrismaService } from './PrismaService';
import { MileageRecord } from './records';

export class MileageTable {
  constructor(private readonly prisma: PrismaService) {}

  async insert(record: MileageRecord): Promise<void> {
    await this.prisma.mileage.create({ data: record });
  }

  rows(plate: string): Promise<MileageRecord[]> {
    return this.prisma.mileage.findMany({ where: { plate } });
  }
}
