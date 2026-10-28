import { Money } from '../../shared-kernel/value-objects/Money';

export interface CastBookingDto {
  id: string;
  productionId: string;
  actorId: string;
  weeklyFee: Money;
  weeks: number;
  status: string;
}
