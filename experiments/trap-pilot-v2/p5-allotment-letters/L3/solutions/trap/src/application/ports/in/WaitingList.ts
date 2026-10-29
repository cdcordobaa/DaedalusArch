export interface ApplicantView {
  readonly name: string;
  readonly position: number;
}

export interface OfferView {
  readonly plotId: string;
  readonly offeredTo: string | null;
  readonly email?: string;
  readonly reminded?: boolean;
}

export interface JoinWaitingList {
  join(name: string, email: string, member: boolean): Promise<ApplicantView>;
  list(): Promise<ApplicantView[]>;
}

export interface OfferPlot {
  offer(plotId: string): Promise<OfferView>;
  remind(plotId: string): Promise<OfferView>;
}
