import { CandidateApplication } from "./candidate-application";
import { JobOpening } from "./job-opening";

export class ScoringService {
  score(app: CandidateApplication, opening: JobOpening): number {
    const surplus = app.yearsExperience - opening.minYears;
    return Math.max(0, Math.min(100, 50 + surplus * 10));
  }

  passes(score: number): boolean {
    return score >= 60;
  }
}
