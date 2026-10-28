import { MemberNotFoundError } from '../domain/errors';
import { ShareSubscription } from '../domain/share-subscription';
import { Statement } from '../domain/statement';
import { GetMemberStatement } from './ports/in/get-member-statement.port';
import { CreditRepository } from './ports/out/credit-repository.port';
import { MemberRepository } from './ports/out/member-repository.port';
import { ShareSubscriptionRepository } from './ports/out/share-subscription-repository.port';

export class GetMemberStatementUseCase implements GetMemberStatement {
  constructor(
    private readonly members: MemberRepository,
    private readonly subscriptions: ShareSubscriptionRepository,
    private readonly credits: CreditRepository,
  ) {}

  async execute(memberId: string): Promise<Statement> {
    const member = await this.members.findById(memberId);
    if (!member) throw new MemberNotFoundError(memberId);
    const subscriptions = await this.subscriptions.findActiveByMember(memberId);
    const shares = ShareSubscription.totalShares(subscriptions);
    const credits = await this.credits.findByMember(memberId);
    return new Statement(member, shares, credits);
  }
}
