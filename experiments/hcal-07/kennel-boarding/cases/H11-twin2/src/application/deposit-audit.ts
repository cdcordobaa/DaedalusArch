import { DepositHold } from '../domain/deposit';

export const DEPOSIT_AUDIT_COLUMNS = ['deposit_ref', 'amount_held', 'refusal_reason', 'held_at'] as const;

export function depositAuditRow(bookingId: string, hold: DepositHold, at: Date): string {
  const values = [hold.depositRef, String(hold.amountHeldCents), hold.refusalReason ?? '', at.toISOString()];
  return `${bookingId};` + DEPOSIT_AUDIT_COLUMNS.map((column, i) => `${column}=${values[i]}`).join(';');
}
