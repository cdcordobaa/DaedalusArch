import { PayrollAuditRepository } from '../../persistence/PayrollAuditRepository';

export interface AuditLine {
  actor: string;
  action: string;
  subject: string;
}

export class PayrollAuditService {
  constructor(private readonly audits: PayrollAuditRepository) {}

  async log(actor: string, action: string, subject: string): Promise<void> {
    await this.audits.add({ id: `${Date.now()}-${subject}`, actor, action, subject, at: new Date() });
  }

  async trail(subject: string): Promise<AuditLine[]> {
    const rows = await this.audits.bySubject(subject);
    return rows.map(({ actor, action }) => ({ actor, action, subject }));
  }
}
