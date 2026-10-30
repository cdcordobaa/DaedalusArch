import type { Applicant } from '../../../../domain/model/Applicant';

export interface OfferNotice {
  readonly email: string;
  readonly status: string;
}

/** Tells an applicant that a plot is theirs to accept. */
export interface OfferNotifier {
  notify(applicant: Applicant, plotId: string): Promise<OfferNotice>;
  remind(applicant: Applicant, plotId: string): Promise<OfferNotice>;
}
