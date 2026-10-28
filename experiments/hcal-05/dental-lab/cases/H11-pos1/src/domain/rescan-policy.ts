export type ScanGrade = 'SF_OK' | 'SF_LOW_RES' | 'SF_MARGIN_UNCLEAR';

export function requiresRescan(grade: ScanGrade): boolean {
  return grade !== 'SF_OK';
}
