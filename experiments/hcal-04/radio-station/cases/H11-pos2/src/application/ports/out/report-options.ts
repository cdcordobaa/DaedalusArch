export enum TimePrecision {
  ExactSecond = 'EXACT_SECOND',
  RoundedMinute = 'ROUNDED_MINUTE',
}

export interface ReportOptions {
  readonly precision: TimePrecision;
}
