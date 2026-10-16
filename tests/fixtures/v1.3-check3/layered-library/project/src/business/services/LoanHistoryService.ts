import { LoanEventGateway } from '../../persistence/LoanEventGateway';

export interface LoanEvent {
  loanId: string;
  kind: string;
  at: Date;
}

export class LoanHistoryService {
  private counter = 0;

  constructor(private readonly events: LoanEventGateway) {}

  async note(loanId: string, kind: string): Promise<void> {
    this.counter += 1;
    await this.events.insert({ id: `evt-${this.counter}`, loanId, kind, at: new Date() });
  }

  async eventsOf(loanId: string): Promise<LoanEvent[]> {
    const rows = await this.events.forLoan(loanId);
    return rows.map((r) => ({ loanId: r.loanId, kind: r.kind, at: r.at }));
  }
}
