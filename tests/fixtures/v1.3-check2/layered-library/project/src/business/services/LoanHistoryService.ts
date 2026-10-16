import { PrismaService } from '../../persistence/PrismaService';

export interface LoanEvent {
  loanId: string;
  kind: string;
  at: Date;
}

export class LoanHistoryService {
  private counter = 0;

  constructor(private readonly db: PrismaService) {}

  async note(loanId: string, kind: string): Promise<void> {
    this.counter += 1;
    await this.db.loanEvent.create({ data: { id: `evt-${this.counter}`, loanId, kind, at: new Date() } });
  }

  async eventsOf(loanId: string): Promise<LoanEvent[]> {
    const rows = await this.db.loanEvent.findMany({ where: { loanId } });
    return rows.map((r) => ({ loanId: r.loanId, kind: r.kind, at: r.at }));
  }
}
