/** Tells an applicant by email that a plot is theirs to take. */
export interface PlotOfferNotifier {
  /** Returns the delivery state reported by the mail service, e.g. 'queued'. */
  notify(name: string, email: string, plotId: string): Promise<string>;
}
