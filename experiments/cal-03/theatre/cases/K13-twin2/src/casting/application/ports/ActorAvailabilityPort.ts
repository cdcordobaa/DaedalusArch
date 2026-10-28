import { Money } from '../../../shared-kernel/value-objects/Money';

export interface ActorAvailabilityPort {
  isFree(actorId: string, from: number, to: number): Promise<boolean>;
  quote(actorId: string, from: number, to: number): Promise<Money>;
}
