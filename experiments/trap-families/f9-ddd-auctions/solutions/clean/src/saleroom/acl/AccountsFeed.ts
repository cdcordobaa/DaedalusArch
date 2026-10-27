import type { AccountSuspendedMessage } from '../../accounts/contracts/AccountMessages';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';

/** Reads what the saleroom needs from the messages accounts publish. */
export const AccountsFeed = {
  suspendedBidder(event: DomainEvent): string {
    return (event as unknown as AccountSuspendedMessage).accountId;
  },
};
