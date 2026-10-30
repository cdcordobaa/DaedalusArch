import { GardenCentreNotifierPort } from '../../../application/ports/out/garden-centre-notifier.port';
import { DispatchStatus } from '../../../domain/dispatch-status';
import { withRetry } from '../shared/retry';

export class EmailGardenCentreNotifier implements GardenCentreNotifierPort {
  async notify(gardenCentreId: string, dispatchId: string, status: DispatchStatus): Promise<void> {
    await withRetry(3, async () => console.log(`[email to ${gardenCentreId}] dispatch ${dispatchId}: ${status}`));
  }
}
