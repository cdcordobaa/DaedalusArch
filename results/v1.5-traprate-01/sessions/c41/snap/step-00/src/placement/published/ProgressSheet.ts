import type { Cefr } from '../../shared-kernel/Cefr';

/** What the placement office tells the rest of the school about a student. `level` is the office's decision. */
export interface ProgressSheet {
  readonly studentId: string;
  readonly name: string;
  readonly standing: number;
  readonly level: Cefr;
}
