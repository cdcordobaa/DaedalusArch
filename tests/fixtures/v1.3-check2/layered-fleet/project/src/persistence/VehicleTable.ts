import { PrismaService } from './PrismaService';
import { VehicleRecord } from './records';

export class VehicleTable {
  constructor(private readonly prisma: PrismaService) {}

  row(plate: string): Promise<VehicleRecord | null> {
    return this.prisma.vehicle.findUnique({ where: { plate } });
  }

  async write(plate: string, changes: Partial<VehicleRecord>): Promise<void> {
    await this.prisma.vehicle.update({ where: { plate }, data: changes });
  }
}
