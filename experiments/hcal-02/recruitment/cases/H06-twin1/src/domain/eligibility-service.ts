import { CandidateApplication } from "./candidate-application";
import { JobOpening } from "./job-opening";

export class EligibilityService {
  meetsMinimumExperience(years: number, minYears: number): boolean {
    return years >= minYears;
  }

  isEligible(app: CandidateApplication, opening: JobOpening, now: Date): boolean {
    return opening.isOpenAt(now) && app.yearsExperience >= opening.minYears;
  }
}
