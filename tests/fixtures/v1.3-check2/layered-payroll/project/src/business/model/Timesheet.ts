import { PayrollRuleError } from './PayrollRuleError';

export const REGULAR_HOURS = 40;
export const OVERTIME_FACTOR = 1.5;

export class Timesheet {
  id: string;
  employeeId: string;
  week: string;
  hours: number;
  approved: boolean;

  constructor(id: string, employeeId: string, week: string, hours: number, approved: boolean) {
    this.id = id;
    this.employeeId = employeeId;
    this.week = week;
    this.hours = hours;
    this.approved = approved;
  }

  approve(): void {
    if (this.approved) throw new PayrollRuleError(`Timesheet ${this.id} is already approved`);
    this.approved = true;
  }

  regularHours(): number {
    return Math.min(this.hours, REGULAR_HOURS);
  }

  overtimeHours(): number {
    return Math.max(0, this.hours - REGULAR_HOURS);
  }
}
