import { GardenCentreNotifierPort } from '../../../application/ports/out/garden-centre-notifier.port';
import { DispatchStatus } from '../../../domain/dispatch-status';

export class EmailGardenCentreNotifier implements GardenCentreNotifierPort {
  async notify(gardenCentreId: string, dispatchId: string, status: DispatchStatus): Promise<void> {
    console.log(`[email to ${gardenCentreId}] dispatch ${dispatchId}: ${status}`);
  }
}
