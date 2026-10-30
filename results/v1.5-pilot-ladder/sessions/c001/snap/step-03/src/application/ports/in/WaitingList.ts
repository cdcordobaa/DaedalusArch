export interface ApplicantView {
  readonly name: string;
  readonly position: number;
}

export interface OfferView {
  readonly plotId: string;
  readonly offeredTo: string | null;
}

export interface JoinWaitingList {
  join(name: string, email: string): Promise<ApplicantView>;
  list(): Promise<ApplicantView[]>;
  leave(email: string): Promise<LeaveView>;
}

export interface LeaveView {
  readonly left: boolean;
}

export interface OfferPlot {
  offer(plotId: string): Promise<OfferView>;
}
