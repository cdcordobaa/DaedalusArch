export interface ApplicantView {
  readonly name: string;
  readonly position: number;
}

export interface OfferView {
  readonly plotId: string;
  readonly offeredTo: string | null;
  /** Delivery state of the offer email, e.g. 'queued'. */
  readonly email: string;
  /** Address the offer email went to. */
  readonly emailedTo: string;
}

export interface ReminderView {
  readonly plotId: string;
  readonly offeredTo: string;
  readonly reminded: true;
}

export interface JoinWaitingList {
  join(name: string, email: string, member: boolean): Promise<ApplicantView>;
  list(): Promise<ApplicantView[]>;
}

export interface OfferPlot {
  offer(plotId: string): Promise<OfferView>;
  remind(plotId: string): Promise<ReminderView>;
}
