import { ChargeOutcome } from '../../../domain/charge-outcome';
export interface EndTripPort {
  end(tripId: string, cardToken: string): Promise<ChargeOutcome>;
}
