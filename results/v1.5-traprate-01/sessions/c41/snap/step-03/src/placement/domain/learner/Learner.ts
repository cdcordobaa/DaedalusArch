import type { Cefr } from '../../../shared-kernel/Cefr';
import { levelForStanding } from './LevelBands';
import { StudentId } from './value-objects/StudentId';

export interface LearnerSnapshot {
  readonly id: string;
  readonly name: string;
  readonly bestScore: number | null;
  /** Runs whose completion has already been added to the standing. */
  readonly credited?: readonly string[];
}

/**
 * A student as the placement office knows them. The standing is the best placement test score (0 before any test), plus 5 for each completed course, at most 100;
 * the CEFR level follows from the standing and nothing else decides it.
 */
export class Learner {
  private constructor(
    readonly id: StudentId,
    readonly name: string,
    private bestScore: number | null,
    private credited: readonly string[] = [],
  ) {}

  static register(id: StudentId, name: string): Learner {
    const clean = name.trim();
    if (clean === '') throw new Error('a student needs a name');
    return new Learner(id, clean, null);
  }

  static fromSnapshot(s: LearnerSnapshot): Learner {
    return new Learner(StudentId.from(s.id), s.name, s.bestScore, s.credited ?? []);
  }

  /** A placement test result: a whole number from 0 to 100. Only the best result counts. */
  sitTest(score: number): void {
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('a test score is a whole number from 0 to 100');
    if (this.bestScore === null || score > this.bestScore) this.bestScore = score;
  }

  /** A completed course run adds 5 to the standing, up to 100. A run is credited only once. */
  creditCompletion(runId: string): void {
    if (this.credited.includes(runId)) return;
    this.credited = [...this.credited, runId];
    this.bestScore = Math.min(100, this.standing() + 5);
  }

  standing(): number {
    return this.bestScore ?? 0;
  }

  level(): Cefr {
    return levelForStanding(this.standing());
  }

  snapshot(): LearnerSnapshot {
    return { id: this.id.raw, name: this.name, bestScore: this.bestScore, credited: [...this.credited] };
  }
}
