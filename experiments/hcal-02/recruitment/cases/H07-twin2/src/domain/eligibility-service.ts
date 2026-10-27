import { CandidateApplication } from "./candidate-application";
import { JobOpening } from "./job-opening";
import { NotEligibleError } from "./errors";

export class EligibilityService {
  assertEligible(app: CandidateApplication, opening: JobOpening, now: Date): void {
    if (!this.isEligible(app, opening, now)) {
      throw new NotEligibleError(app.id);
    }
  }

  isEligible(app: CandidateApplication, opening: JobOpening, now: Date): boolean {
    return opening.isOpenAt(now) && app.yearsExperience >= opening.minYears;
  }
}
