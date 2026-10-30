import type { Applicant } from '../model/Applicant';

/** Whose turn it is: members of the garden association first, then everyone else, each in the order they joined. */
export class QueueOrder {
  next(waiting: readonly Applicant[]): Applicant | undefined {
    return waiting.find((a) => a.member) ?? waiting[0];
  }
}
