/** Tells an applicant that a plot has been offered to them. Resolves to 'rejected' when the address is dead. */
export interface PlotOfferNotifier {
  notify(name: string, email: string, plotId: string): Promise<'delivered' | 'rejected'>;
}
