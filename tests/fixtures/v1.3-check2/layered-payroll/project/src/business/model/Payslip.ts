import { Employee } from './Employee';
import { OVERTIME_FACTOR, Timesheet } from './Timesheet';

export class Payslip {
  employeeId: string;
  week: string;
  grossCents: number;

  constructor(employeeId: string, week: string, grossCents: number) {
    this.employeeId = employeeId;
    this.week = week;
    this.grossCents = grossCents;
  }

  static compute(employee: Employee, sheet: Timesheet): Payslip {
    const overtime = employee.overtimeEligible() ? sheet.overtimeHours() * OVERTIME_FACTOR : 0;
    const paidHours = sheet.regularHours() + overtime;
    return new Payslip(employee.id, sheet.week, Math.round(paidHours * employee.hourlyRateCents));
  }
}
