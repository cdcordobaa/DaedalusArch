declare module '@prisma/client' {
  export interface EmployeeRow { id: string; name: string; hourlyRateCents: number; contract: string; active: boolean }
  export interface TimesheetRow { id: string; employeeId: string; week: string; hours: number; approved: boolean }
  export interface PayrollAuditRow { id: string; actor: string; action: string; subject: string; at: Date }
  export interface Delegate<T, K extends keyof T> {
    findUnique(args: { where: Pick<T, K> }): Promise<T | null>;
    findMany(args?: { where?: Partial<T> }): Promise<T[]>;
    create(args: { data: T }): Promise<T>;
    update(args: { where: Pick<T, K>; data: Partial<T> }): Promise<T>;
  }
  export class PrismaClient {
    employee: Delegate<EmployeeRow, 'id'>;
    timesheet: Delegate<TimesheetRow, 'id'>;
    payrollAudit: Delegate<PayrollAuditRow, 'id'>;
    $connect(): Promise<void>;
  }
}
