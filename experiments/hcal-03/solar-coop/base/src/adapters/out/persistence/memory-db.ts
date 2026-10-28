import { Member } from '../../../domain/member';
import { ProductionCredit } from '../../../domain/production-credit';
import { ShareSubscription } from '../../../domain/share-subscription';

export class MemoryDb {
  readonly members = new Map<string, Member>();
  readonly subscriptions = new Map<string, ShareSubscription>();
  readonly credits = new Map<string, ProductionCredit>();
}

export interface MemoryTx {
  readonly db: MemoryDb;
}
