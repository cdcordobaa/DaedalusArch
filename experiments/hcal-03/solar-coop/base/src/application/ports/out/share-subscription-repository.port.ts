import { ShareSubscription } from '../../../domain/share-subscription';

export interface ShareSubscriptionRepository {
  findAllActive(): Promise<ShareSubscription[]>;
  findActiveByMember(memberId: string): Promise<ShareSubscription[]>;
  save(subscription: ShareSubscription): Promise<void>;
}
