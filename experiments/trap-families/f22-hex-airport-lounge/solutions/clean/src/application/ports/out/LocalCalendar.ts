import type { AirportCode } from '../../../domain/model/AirportCode';
import type { Instant } from '../../../domain/model/Instant';
import type { LocalDate } from '../../../domain/model/LocalDate';
import type { LocalTime } from '../../../domain/model/LocalTime';

/** The calendar as it is read at an airport. */
export interface LocalCalendar {
  /** The date at `airport` at the moment `at`. */
  dateAt(airport: AirportCode, at: Instant): LocalDate;
  /** The wall clock at `airport` at the moment `at`. */
  timeAt(airport: AirportCode, at: Instant): LocalTime;
}
