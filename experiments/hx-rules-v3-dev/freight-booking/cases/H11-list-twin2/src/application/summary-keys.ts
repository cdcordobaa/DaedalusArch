export const SUMMARY_KEYS = ['currency', 'weight', 'pallets'] as const;

export function summaryLine(values: Record<(typeof SUMMARY_KEYS)[number], string>): string {
  return SUMMARY_KEYS.map((k) => `${k}=${values[k]}`).join(' ');
}
