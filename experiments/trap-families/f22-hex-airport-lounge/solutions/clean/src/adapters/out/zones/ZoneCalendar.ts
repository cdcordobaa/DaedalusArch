import type { LocalCalendar } from '../../../application/ports/out/LocalCalendar';
import type { AirportCode } from '../../../domain/model/AirportCode';
import type { Instant } from '../../../domain/model/Instant';
import { localDate, type LocalDate } from '../../../domain/model/LocalDate';
import type { LocalTime } from '../../../domain/model/LocalTime';
import { localClock } from './AirportZones';

export class ZoneCalendar implements LocalCalendar {
  dateAt(airport: AirportCode, at: Instant): LocalDate {
    return this.timeAt(airport, at).date;
  }

  timeAt(airport: AirportCode, at: Instant): LocalTime {
    const wall = localClock(airport, at);
    return { date: localDate(wall.date), hour: wall.hour, minute: wall.minute };
  }
}
