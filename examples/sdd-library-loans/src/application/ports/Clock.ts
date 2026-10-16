/** Outbound port: the current time, so the core never reads the system clock itself. */
export interface Clock {
  now(): Date;
}
