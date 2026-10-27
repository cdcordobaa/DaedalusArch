import { BackersFacade } from './backers';
import { InMemoryBackerRepository } from './backers/infrastructure/InMemoryBackerRepository';
import { BackerHandles } from './campaigns/application/BackerHandles';
import { CloseCampaign, type ClosingResult } from './campaigns/application/CloseCampaign';
import { CreatorMessages } from './campaigns/application/CreatorMessages';
import { LaunchCampaign } from './campaigns/application/LaunchCampaign';
import { OutboxDispatcher } from './campaigns/application/OutboxDispatcher';
import { PlacePledge, type PledgeReceipt } from './campaigns/application/PlacePledge';
import { InMemoryCampaignRepository } from './campaigns/infrastructure/InMemoryCampaignRepository';
import { InMemoryCreatorInbox } from './campaigns/infrastructure/InMemoryCreatorInbox';
import { InMemoryOutboxTable } from './campaigns/infrastructure/InMemoryOutboxTable';

/** Composition root. A campaign command hands on the facts it stored before it returns. */
export function createApp() {
  const backerStore = new InMemoryBackerRepository();
  const backers = new BackersFacade(backerStore);
  const outbox = new InMemoryOutboxTable();
  const campaigns = new InMemoryCampaignRepository(outbox);
  const inbox = new InMemoryCreatorInbox();
  const dispatcher = new OutboxDispatcher(outbox);
  const messages = new CreatorMessages(inbox, new BackerHandles(backerStore));
  dispatcher.subscribe('PledgeMade', (e) => messages.onPledgeMade(e));
  dispatcher.subscribe('CampaignClosed', (e) => messages.onCampaignClosed(e));
  const settle = <T>(command: () => T): T => {
    const result = command();
    dispatcher.deliverPending();
    return result;
  };
  return {
    registerBacker: (handle: string): string => backers.register(handle),
    recordPastBackings: (backerId: string, amount: number): void => backers.recordPastBackings(backerId, amount),
    recordMissedPayment: (backerId: string): void => backers.recordMissedPayment(backerId),
    backerProfile: (backerId: string) => backers.profile(backerId),
    launchCampaign: (title: string, goal: number): string => settle(() => new LaunchCampaign(campaigns).execute(title, goal)),
    pledge: (campaignId: string, backerId: string, amount: number): PledgeReceipt =>
      settle(() => new PlacePledge(campaigns, backerStore).execute(campaignId, backerId, amount)),
    closeCampaign: (campaignId: string): ClosingResult => settle(() => new CloseCampaign(campaigns, backerStore).execute(campaignId)),
    creatorMessages: (): string[] => inbox.messages(),
  };
}
