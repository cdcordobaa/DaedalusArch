import { CandidateApplication } from "./candidate-application";
import { JobOpening } from "./job-opening";

export class EligibilityService {
  isEligible(app: CandidateApplication, opening: JobOpening, now: Date): boolean {
    return opening.isOpenAt(now) && app.yearsExperience >= opening.minYears;
  }
}
