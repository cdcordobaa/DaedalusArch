import type { OwnerNotifierPort } from '../../../application/ports/out/owner-notifier.port';

export class ConsoleOwnerNotifier implements OwnerNotifierPort {
  async notify(ownerId: string, message: string): Promise<void> {
    console.log(`[to ${ownerId}] ${message}`);
  }
}
