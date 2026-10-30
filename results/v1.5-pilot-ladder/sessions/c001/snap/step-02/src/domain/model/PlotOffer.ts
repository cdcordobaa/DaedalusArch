import type { Applicant } from './Applicant';

/** A plot offered to the person whose turn it was. */
export interface PlotOffer {
  readonly plotId: string;
  readonly applicant: Applicant;
}
