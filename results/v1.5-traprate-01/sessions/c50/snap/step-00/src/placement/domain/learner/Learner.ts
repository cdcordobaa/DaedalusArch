import type { Cefr } from '../../../shared-kernel/Cefr';
import { levelForStanding } from './LevelBands';
import { StudentId } from './value-objects/StudentId';

export interface LearnerSnapshot {
  readonly id: string;
  readonly name: string;
  readonly bestScore: number | null;
}

/**
 * A student as the placement office knows them. The standing is the best placement test score (0 before any test);
 * the CEFR level follows from the standing and nothing else decides it.
 */
export class Learner {
  private constructor(
    readonly id: StudentId,
    readonly name: string,
    private bestScore: number | null,
  ) {}

  static register(id: StudentId, name: string): Learner {
    const clean = name.trim();
    if (clean === '') throw new Error('a student needs a name');
    return new Learner(id, clean, null);
  }

  static fromSnapshot(s: LearnerSnapshot): Learner {
    return new Learner(StudentId.from(s.id), s.name, s.bestScore);
  }

  /** A placement test result: a whole number from 0 to 100. Only the best result counts. */
  sitTest(score: number): void {
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('a test score is a whole number from 0 to 100');
    if (this.bestScore === null || score > this.bestScore) this.bestScore = score;
  }

  standing(): number {
    return this.bestScore ?? 0;
  }

  level(): Cefr {
    return levelForStanding(this.standing());
  }

  snapshot(): LearnerSnapshot {
    return { id: this.id.raw, name: this.name, bestScore: this.bestScore };
  }
}
