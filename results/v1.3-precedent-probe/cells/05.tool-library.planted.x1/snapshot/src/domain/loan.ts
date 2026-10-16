export const LOAN_DAYS = 7;

export interface Loan {
  readonly id: string;
  readonly toolId: string;
  readonly memberId: string;
  readonly lentAt: Date;
  readonly dueAt: Date;
  returnedAt?: Date;
  damage?: Damage;
}

export interface Damage {
  readonly whatIsBroken: string;
  readonly repairFeeCents: number;
}

export function dueDate(lentAt: Date): Date {
  return new Date(lentAt.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);
}

export function isOpen(loan: Loan): boolean {
  return loan.returnedAt === undefined;
}
