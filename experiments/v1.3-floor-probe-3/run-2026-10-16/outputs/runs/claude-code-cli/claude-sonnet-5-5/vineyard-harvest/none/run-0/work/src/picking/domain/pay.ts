import { DomainError, conflict } from "../../shared/errors.js";

export type BinStatus = "accepted" | "rejected" | "pending";

/** The cellar's verdict on a bin, as picking needs it. */
export interface BinOutcome {
  readonly status: BinStatus;
  readonly grossKg?: number;
}

export interface PayRules {
  readonly pieceRatePerKg: number;
  readonly binTareKg: Readonly<Record<string, number>>;
}

export interface StatementBin {
  readonly date: string;
  readonly tag: number;
  readonly binType: string | null;
  readonly status: BinStatus;
  readonly grossKg: number | null;
  readonly tareKg: number;
  readonly netKg: number | null;
  readonly pay: number;
}

export interface StatementDay {
  readonly date: string;
  readonly hours: number;
}

export interface PayStatement {
  readonly pickerId: string;
  readonly pickerName: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly hourlyRate: number;
  readonly pieceRatePerKg: number;
  readonly days: StatementDay[];
  readonly totalHours: number;
  readonly hoursPay: number;
  readonly bins: StatementBin[];
  readonly acceptedNetKg: number;
  readonly piecePay: number;
  readonly total: number;
  readonly approved: boolean;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const DAY_MS = 86_400_000;

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the week containing the date. */
export function weekStartOf(date: string): string {
  const dow = new Date(Date.parse(date)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export function weekDates(weekStart: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i));
}

export function requireWeekStart(date: string): string {
  if (weekStartOf(date) !== date) throw new DomainError("week must be the Monday that starts the week");
  return date;
}

export function newPayRules(): PayRules {
  return { pieceRatePerKg: 0, binTareKg: {} };
}

export function binStatementLine(
  date: string,
  tag: number,
  binType: string | undefined,
  outcome: BinOutcome,
  rules: PayRules,
): StatementBin {
  const tareKg = binType === undefined ? 0 : (rules.binTareKg[binType] ?? 0);
  const netKg = outcome.grossKg === undefined ? null : Math.max(0, outcome.grossKg - tareKg);
  const pay = outcome.status === "accepted" && netKg !== null ? round2(netKg * rules.pieceRatePerKg) : 0;
  return {
    date,
    tag,
    binType: binType ?? null,
    status: outcome.status,
    grossKg: outcome.grossKg ?? null,
    tareKg,
    netKg,
    pay,
  };
}

/** Aggregate: the approval of one week's pay. Once approved, the statements are frozen. */
export class ApprovedWeek {
  constructor(
    readonly weekStart: string,
    readonly approvedAt: string,
    private readonly statements: PayStatement[],
  ) {}

  statementFor(pickerId: string): PayStatement | undefined {
    return this.statements.find((s) => s.pickerId === pickerId);
  }

  list(): PayStatement[] {
    return [...this.statements];
  }
}

export function assertWeekOpen(approved: ApprovedWeek | undefined, weekStart: string): void {
  if (approved) throw conflict(`pay for the week of ${weekStart} is approved and can no longer change`);
}
