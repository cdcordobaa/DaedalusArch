import type { Applicant } from '../../../domain/model/Applicant';

/** Tells an applicant that a plot has been offered to them. Resolves false when the address is rejected. */
export interface PlotOfferNotifier {
  notify(applicant: Applicant, plotId: string): Promise<boolean>;
}
