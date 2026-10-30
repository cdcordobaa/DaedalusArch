export enum StayStatus {
  Held = 'held',
  Conf = 'conf',
  NoShow = 'no-show',
  Cxl = 'cxl',
  CxlLate = 'cxl-late',
}

export interface Stay {
  readonly reservationId: string;
  readonly status: StayStatus;
  readonly nightlyRateCents: number;
}
