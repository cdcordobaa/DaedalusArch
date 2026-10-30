import { ClientNotifierPort } from '../../../application/ports/out/client-notifier.port';
import { ClearanceState } from '../../../domain/clearance';

export class ConsoleClientNotifier implements ClientNotifierPort {
  async notifyFiling(importerId: string, shipmentId: string, state: ClearanceState): Promise<void> {
    console.log(`[to ${importerId}] shipment ${shipmentId}: ${state}`);
  }
}
