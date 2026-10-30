export const STATEMENT_COLUMNS = ['booking_ref', 'booking_state', 'freight_charge', 'fuel_surcharge', 'confirmed_at'] as const;

export function statementHeader(): string {
  return STATEMENT_COLUMNS.join(';');
}
