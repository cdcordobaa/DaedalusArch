import type { Applicant } from '../../../domain/model/Applicant';

export type LetterKind = 'welcome' | 'offer';

/** Letters we send to the people on the list, in the application's own terms. */
export interface Letters {
  /** Answers false when the address refused the letter. */
  send(to: Applicant, letter: LetterKind, details: Record<string, string>): Promise<boolean>;
}
