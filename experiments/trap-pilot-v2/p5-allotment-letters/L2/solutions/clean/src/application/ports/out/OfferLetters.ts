import type { Applicant } from '../../../domain/model/Applicant';

/** The letters that offer a plot, in the application's own terms. */
export interface OfferLetters {
  /** Answers false when the address refused the letter. */
  offer(to: Applicant, plotId: string): Promise<boolean>;
}
