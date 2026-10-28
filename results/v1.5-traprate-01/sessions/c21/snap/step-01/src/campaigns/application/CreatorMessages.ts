import { Amount } from '../../shared-kernel/Amount';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { CampaignClosed } from '../domain/campaign/events/CampaignClosed';
import type { PledgeMade } from '../domain/campaign/events/PledgeMade';
import type { BackerHandles } from './BackerHandles';
import type { CreatorInbox } from './ports/CreatorInbox';

/** Tells creators about what happened on their campaigns. Runs on stored facts, after the change is saved. */
export class CreatorMessages {
  constructor(
    private readonly inbox: CreatorInbox,
    private readonly handles: BackerHandles,
  ) {}

  onPledgeMade(event: DomainEvent): void {
    const made = event as PledgeMade;
    this.inbox.post(`${made.campaignId}: pledge ${made.pledgeId} of ${Amount.ofCents(made.amountCents).label()} from ${this.handles.handleOf(made.backerId)}.`);
  }

  onCampaignClosed(event: DomainEvent): void {
    const closed = event as CampaignClosed;
    const raised = Amount.ofCents(closed.raisedCents).label();
    this.inbox.post(closed.outcome === 'funded'
      ? `${closed.campaignId} "${closed.title}" is funded: ${raised} from ${String(closed.collected.length)} pledges.`
      : `${closed.campaignId} "${closed.title}" missed its goal; every pledge was released.`);
  }
}
