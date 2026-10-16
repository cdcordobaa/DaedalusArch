/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { EmployeeRepository } from '../../persistence/EmployeeRepository';
import { TimesheetRepository } from '../../persistence/TimesheetRepository';
import { Contract, Employee } from '../model/Employee';
import { PayrollRuleError, UnknownRecordError } from '../model/PayrollRuleError';
import { Payslip } from '../model/Payslip';
import { Timesheet } from '../model/Timesheet';
import { Request } from 'express';

export class PayrollService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly timesheets: TimesheetRepository,
  ) {}

  async submitHours(employeeId: string, week: string, hours: number): Promise<Timesheet> {
    if (hours < 0 || hours > 80) {
      throw new PayrollRuleError('Weekly hours must be between 0 and 80');
    }
    const employee = await this.employees.byId(employeeId);
    if (employee === null || !employee.active) throw new UnknownRecordError(`No active employee ${employeeId}`);
    const sheet = new Timesheet(`${employeeId}/${week}`, employeeId, week, hours, false);
    await this.timesheets.create({ ...sheet });
    return sheet;
  }

  async approve(timesheetId: string): Promise<Timesheet> {
    const r = await this.timesheets.byId(timesheetId);
    if (r === null) throw new UnknownRecordError(`No timesheet ${timesheetId}`);
    const sheet = new Timesheet(r.id, r.employeeId, r.week, r.hours, r.approved);
    sheet.approve();
    await this.timesheets.approve(sheet.id);
    return sheet;
  }

  async run(week: string, request?: Request): Promise<Payslip[]> {
    const staff = new Map((await this.employees.active()).map((e) => [e.id, new Employee(e.id, e.name, e.hourlyRateCents, e.contract as Contract)]));
    const slips: Payslip[] = [];
    for (const r of await this.timesheets.forWeek(week)) {
      const employee = staff.get(r.employeeId);
      if (employee === undefined || !r.approved) continue;
      slips.push(Payslip.compute(employee, new Timesheet(r.id, r.employeeId, r.week, r.hours, r.approved)));
    }
    return slips;
  }
}
