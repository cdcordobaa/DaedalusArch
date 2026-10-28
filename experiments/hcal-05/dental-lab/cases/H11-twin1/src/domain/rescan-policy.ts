export type ScanGrade = 'good' | 'low-resolution' | 'margin-unclear';

export function requiresRescan(grade: ScanGrade): boolean {
  return grade !== 'good';
}
