import { ShareSubscription } from '../../../domain/share-subscription';

export interface SubscribeShares {
  execute(command: { memberId: string; shares: number }): Promise<ShareSubscription>;
}
