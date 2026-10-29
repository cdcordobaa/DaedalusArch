import type { HoldState } from '../../../domain/model/HoldState';

/** The money a guest's card holds for a booking, in the application's own terms; amounts in euros. */
export interface CardHolds {
  stateOf(paymentId: string): Promise<HoldState>;
  /** Takes the held money; answers the amount taken, or null when nothing could be taken. */
  take(paymentId: string): Promise<number | null>;
  release(paymentId: string): Promise<void>;
}
