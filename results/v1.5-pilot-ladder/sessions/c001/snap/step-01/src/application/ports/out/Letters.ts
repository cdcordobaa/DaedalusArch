import type { Applicant } from '../../../domain/model/Applicant';

export type LetterKind = 'welcome' | 'plot-offer';

/** Letters we send to the people on the list, in the application's own terms. */
export interface Letters {
  /** Sends one of our letters. */
  send(to: Applicant, letter: LetterKind, details: Record<string, string>): Promise<void>;
}
