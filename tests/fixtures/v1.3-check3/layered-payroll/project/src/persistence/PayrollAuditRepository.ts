import { PrismaService } from './PrismaService';

export interface PayrollAuditRecord {
  id: string;
  actor: string;
  action: string;
  subject: string;
  at: Date;
}

export class PayrollAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async add(record: PayrollAuditRecord): Promise<void> {
    await this.prisma.payrollAudit.create({ data: record });
  }

  bySubject(subject: string): Promise<PayrollAuditRecord[]> {
    return this.prisma.payrollAudit.findMany({ where: { subject } });
  }
}
