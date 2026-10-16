import { PrismaService } from './PrismaService';

export interface LoanEventRecord {
  id: string;
  loanId: string;
  kind: string;
  at: Date;
}

export class LoanEventGateway {
  constructor(private readonly db: PrismaService) {}

  async insert(record: LoanEventRecord): Promise<void> {
    await this.db.loanEvent.create({ data: record });
  }

  forLoan(loanId: string): Promise<LoanEventRecord[]> {
    return this.db.loanEvent.findMany({ where: { loanId } });
  }
}
