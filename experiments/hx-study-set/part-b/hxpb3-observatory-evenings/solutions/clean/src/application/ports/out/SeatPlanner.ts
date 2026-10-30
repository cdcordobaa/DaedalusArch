import type { Evening } from '../../../domain/model/Evening';

/** The dome's seat plan, in the observatory's own terms. */
export interface SeatPlanner {
  month(month: string): Promise<Evening[]>;
  /** Holds the seats; answers the hold reference, which is the booking reference. */
  reserve(evening: string, seats: number, children: number): Promise<string>;
}
