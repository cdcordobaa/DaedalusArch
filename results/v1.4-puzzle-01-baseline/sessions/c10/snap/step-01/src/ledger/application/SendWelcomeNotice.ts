import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { AccountOpened } from '../domain/account/events/AccountOpened';
import type { Notices } from './ports/Notices';

export class SendWelcomeNotice {
  constructor(private readonly notices: Notices) {}

  handle(event: DomainEvent): void {
    const opened = event as AccountOpened;
    this.notices.add(opened.accountId, `Welcome, ${opened.owner}: account ${opened.accountId} is open.`);
  }
}
