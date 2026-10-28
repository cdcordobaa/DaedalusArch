import { ArrayCapacity } from '../domain/array-capacity';
import { MemberNotFoundError } from '../domain/errors';
import { ShareSubscription } from '../domain/share-subscription';
import { SubscribeShares } from './ports/in/subscribe-shares.port';
import { Clock } from './ports/out/clock.port';
import { MemberRepository } from './ports/out/member-repository.port';
import { Notifier } from './ports/out/notifier.port';
import { ShareSubscriptionRepository } from './ports/out/share-subscription-repository.port';

interface Receipt {
  to: string;
  subject: string;
  body: string;
}

export class SubscribeSharesUseCase implements SubscribeShares {
  constructor(
    private readonly members: MemberRepository,
    private readonly subscriptions: ShareSubscriptionRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
  ) {}

  async execute(command: { memberId: string; shares: number }): Promise<ShareSubscription> {
    const member = await this.members.findById(command.memberId);
    if (!member) throw new MemberNotFoundError(command.memberId);
    const active = await this.subscriptions.findAllActive();
    const subscribed = ShareSubscription.totalShares(active);
    ArrayCapacity.ensureAvailable(subscribed, command.shares);
    const subscription = ShareSubscription.open(
      `sub-${this.clock.now().getTime()}`,
      member.id,
      command.shares,
    );
    await this.subscriptions.save(subscription);
    const receipt: Receipt = {
      to: member.id,
      subject: 'Shares confirmed',
      body: `You hold ${command.shares} new shares`,
    };
    await this.notifier.notify(receipt.to, receipt.subject, receipt.body);
    return subscription;
  }
}
