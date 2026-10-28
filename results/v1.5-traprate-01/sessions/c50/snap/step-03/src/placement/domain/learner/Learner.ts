import type { Cefr } from '../../../shared-kernel/Cefr';
import { levelForStanding } from './LevelBands';
import { StudentId } from './value-objects/StudentId';

export interface LearnerSnapshot {
  readonly id: string;
  readonly name: string;
  readonly bestScore: number | null;
  readonly completedRuns?: readonly string[];
}

const COMPLETION_BONUS = 5;
const MAX_STANDING = 100;

/**
 * A student as the placement office knows them. The standing is the best placement test score (0 before any test);
 * the CEFR level follows from the standing and nothing else decides it.
 */
export class Learner {
  private constructor(
    readonly id: StudentId,
    readonly name: string,
    private bestScore: number | null,
    private completedRuns: readonly string[],
  ) {}

  static register(id: StudentId, name: string): Learner {
    const clean = name.trim();
    if (clean === '') throw new Error('a student needs a name');
    return new Learner(id, clean, null, []);
  }

  static fromSnapshot(s: LearnerSnapshot): Learner {
    return new Learner(StudentId.from(s.id), s.name, s.bestScore, [...(s.completedRuns ?? [])]);
  }

  /** A placement test result: a whole number from 0 to 100. Only the best result counts. */
  sitTest(score: number): void {
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('a test score is a whole number from 0 to 100');
    if (this.bestScore === null || score > this.bestScore) this.bestScore = score;
  }

  /** Each completed course run adds 5 to the standing, once per run, up to 100. */
  creditCompletion(runId: string): void {
    if (this.completedRuns.includes(runId)) return;
    this.completedRuns = [...this.completedRuns, runId];
  }

  standing(): number {
    return Math.min(MAX_STANDING, (this.bestScore ?? 0) + COMPLETION_BONUS * this.completedRuns.length);
  }

  level(): Cefr {
    return levelForStanding(this.standing());
  }

  snapshot(): LearnerSnapshot {
    return { id: this.id.raw, name: this.name, bestScore: this.bestScore, completedRuns: [...this.completedRuns] };
  }
}
