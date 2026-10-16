import { PrismaService } from './PrismaService';
import { ScanData } from './schema/ScanData';

export class ScanStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(scan: ScanData): Promise<void> {
    await this.prisma.scan.create({ data: scan });
  }

  all(): Promise<ScanData[]> {
    return this.prisma.scan.findMany();
  }
}
