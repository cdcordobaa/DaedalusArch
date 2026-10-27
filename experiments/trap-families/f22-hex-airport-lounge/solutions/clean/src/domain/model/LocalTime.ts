import type { LocalDate } from './LocalDate';

/** The wall clock at one airport: its date and the hour and minute shown there. */
export interface LocalTime {
  readonly date: LocalDate;
  /** 0-23 */
  readonly hour: number;
  readonly minute: number;
}
