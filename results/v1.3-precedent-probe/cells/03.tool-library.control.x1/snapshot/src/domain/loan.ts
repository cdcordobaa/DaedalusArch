export const LOAN_DAYS = 7;

export interface Loan {
  readonly id: string;
  readonly toolId: string;
  readonly memberId: string;
  readonly lentAt: Date;
  readonly dueAt: Date;
  returnedAt?: Date;
  damage?: DamageReport;
}

export interface DamageReport {
  readonly description: string;
  readonly repairFeeCents: number;
  readonly recordedAt: Date;
}

export function dueDate(lentAt: Date): Date {
  return new Date(lentAt.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);
}

export function isOpen(loan: Loan): boolean {
  return loan.returnedAt === undefined;
}

export function formatFee(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}
