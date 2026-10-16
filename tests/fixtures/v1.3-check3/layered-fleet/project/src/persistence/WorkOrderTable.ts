import { PrismaService } from './PrismaService';
import { WorkOrderRecord } from './records';

export class WorkOrderTable {
  constructor(private readonly prisma: PrismaService) {}

  row(id: string): Promise<WorkOrderRecord | null> {
    return this.prisma.workOrder.findUnique({ where: { id } });
  }

  openFor(plate: string): Promise<WorkOrderRecord[]> {
    return this.prisma.workOrder.findMany({ where: { plate, state: 'open' } });
  }

  async insert(row: WorkOrderRecord): Promise<void> {
    await this.prisma.workOrder.create({ data: row });
  }

  async write(id: string, changes: Partial<WorkOrderRecord>): Promise<void> {
    await this.prisma.workOrder.update({ where: { id }, data: changes });
  }
}
