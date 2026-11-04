export const MOVEMENT_FIELDS = ['imo_number', 'berth_window_ref', 'phase', 'reported_at_utc'] as const;

export function isCompleteReport(report: Readonly<Record<string, unknown>>): boolean {
  return MOVEMENT_FIELDS.every((field) => report[field] !== undefined && report[field] !== null);
}
