import { PrismaService } from '../../persistence/PrismaService';

export interface AuditLine {
  actor: string;
  action: string;
  subject: string;
}

export class PayrollAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(actor: string, action: string, subject: string): Promise<void> {
    await this.prisma.payrollAudit.create({ data: { id: `${Date.now()}-${subject}`, actor, action, subject, at: new Date() } });
  }

  async trail(subject: string): Promise<AuditLine[]> {
    const rows = await this.prisma.payrollAudit.findMany({ where: { subject } });
    return rows.map(({ actor, action }) => ({ actor, action, subject }));
  }
}
