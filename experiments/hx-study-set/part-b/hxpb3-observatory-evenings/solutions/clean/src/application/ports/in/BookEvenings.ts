import type { Booking } from '../../../domain/model/Booking';
import type { Evening } from '../../../domain/model/Evening';

export interface BookEvenings {
  eveningsIn(month: string): Promise<Evening[]>;
  book(evening: string, adults: number, children: number): Promise<Booking>;
}
