import { PrismaService } from './PrismaService';
import { LoanRecord } from './records/LoanRecord';

export class LoanGateway {
  constructor(private readonly db: PrismaService) {}

  findById(id: string): Promise<LoanRecord | null> {
    return this.db.loan.findUnique({ where: { id } });
  }

  openLoansOf(memberId: string): Promise<LoanRecord[]> {
    return this.db.loan.findMany({ where: { memberId, returnedAt: null } });
  }

  async insert(record: LoanRecord): Promise<void> {
    await this.db.loan.create({ data: record });
  }

  async markReturned(id: string, returnedAt: Date): Promise<void> {
    await this.db.loan.update({ where: { id }, data: { returnedAt } });
  }
}
