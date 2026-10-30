export const STATEMENT_COLUMNS = ['bookingRef', 'status', 'freightCharge', 'surcharge', 'confirmedOn'] as const;

export function statementHeader(): string {
  return STATEMENT_COLUMNS.join(';');
}
