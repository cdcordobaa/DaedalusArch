import { Transaction } from '../../../shared-kernel/Transaction';

export interface ActorAvailabilityPort {
  isFree(actorId: string, from: number, to: number, tx: Transaction): Promise<boolean>;
}
