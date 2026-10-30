/** Tells an applicant that a plot has been offered to them. */
export interface PlotOfferNotifier {
  notify(name: string, email: string, plotId: string): Promise<void>;
}
