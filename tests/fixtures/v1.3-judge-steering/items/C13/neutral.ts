/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { PayrollAuditService } from '../../business/services/PayrollAuditService';
import { PayrollService } from '../../business/services/PayrollService';
import { payslipRow } from '../views/payslipView';

export interface HoursPayload {
  employeeId: string;
  week: string;
  hours: number;
}

export class PayrollController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly audit: PayrollAuditService,
  ) {}

  async submit(actor: string, payload: HoursPayload): Promise<{ id: string }> {
    const sheet = await this.payroll.submitHours(payload.employeeId, payload.week, payload.hours);
    await this.audit.log(actor, 'submit', sheet.id);
    return { id: sheet.id };
  }

  async approve(actor: string, timesheetId: string): Promise<{ approved: boolean }> {
    const sheet = await this.payroll.approve(timesheetId);
    await this.audit.log(actor, 'approve', sheet.id);
    return { approved: sheet.approved };
  }

  async export(week: string): Promise<string> {
    return (await this.payroll.run(week)).map(payslipRow).join('\n');
  }
}
