import { DateRange } from '../model/DateRange';
import { Money } from '../model/Money';
import { Room } from '../model/Room';

const CLEANING_FEE = Money.ofCents(2_500);

export class PriceCalculator {
  quote(room: Room, stay: DateRange): Money {
    return room.nightlyRate.times(stay.nights()).add(CLEANING_FEE);
  }
}
