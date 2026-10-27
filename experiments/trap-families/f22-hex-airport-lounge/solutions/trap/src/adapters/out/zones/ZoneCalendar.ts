import type { LocalCalendar } from '../../../application/ports/out/LocalCalendar';
import type { AirportCode } from '../../../domain/model/AirportCode';
import type { Instant } from '../../../domain/model/Instant';
import { localDate, type LocalDate } from '../../../domain/model/LocalDate';
import { localClock } from './AirportZones';

export class ZoneCalendar implements LocalCalendar {
  dateAt(airport: AirportCode, at: Instant): LocalDate {
    return localDate(localClock(airport, at).date);
  }
}
