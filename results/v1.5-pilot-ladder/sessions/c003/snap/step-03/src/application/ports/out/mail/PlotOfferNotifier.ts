/** Tells an applicant by email that a plot is theirs to take. */
export interface PlotOfferNotifier {
  /** Returns the delivery state reported by the mail service, e.g. 'queued'. */
  notify(name: string, email: string, plotId: string): Promise<string>;
  /** Nudges the person a plot was offered to; returns the delivery state. */
  remind(name: string, email: string, plotId: string): Promise<string>;
}
