import { CandidateApplication } from "./candidate-application";
import { JobOpening } from "./job-opening";

export class ScoringService {
  constructor(private readonly log: (message: string) => void = () => undefined) {}

  score(app: CandidateApplication, opening: JobOpening): number {
    const surplus = app.yearsExperience - opening.minYears;
    const value = Math.max(0, Math.min(100, 50 + surplus * 10));
    this.log(`score ${value}`);
    return value;
  }

  passes(score: number): boolean {
    return score >= 60;
  }
}
