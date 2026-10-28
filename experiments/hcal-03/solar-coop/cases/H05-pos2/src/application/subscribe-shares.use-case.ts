import { SystemClock } from '../adapters/out/time/system-clock';
import { ArrayCapacity } from '../domain/array-capacity';
import { MemberNotFoundError } from '../domain/errors';
import { ShareSubscription } from '../domain/share-subscription';
import { SubscribeShares } from './ports/in/subscribe-shares.port';
import { Clock } from './ports/out/clock.port';
import { MemberRepository } from './ports/out/member-repository.port';
import { Notifier } from './ports/out/notifier.port';
import { ShareSubscriptionRepository } from './ports/out/share-subscription-repository.port';

export class SubscribeSharesUseCase implements SubscribeShares {
  constructor(
    private readonly members: MemberRepository,
    private readonly subscriptions: ShareSubscriptionRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock = new SystemClock(),
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
    await this.notifier.notify(member.id, 'Shares confirmed', `You hold ${command.shares} new shares`);
    return subscription;
  }
}
