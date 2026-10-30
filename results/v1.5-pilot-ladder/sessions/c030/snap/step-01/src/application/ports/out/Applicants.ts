import type { Applicant } from '../../../domain/model/Applicant';

/** The waiting list, in order. */
export interface Applicants {
  add(applicant: Applicant): Promise<void>;
  all(): Promise<Applicant[]>;
  remove(email: string): Promise<void>;
  moveToEnd(email: string): Promise<void>;
}
