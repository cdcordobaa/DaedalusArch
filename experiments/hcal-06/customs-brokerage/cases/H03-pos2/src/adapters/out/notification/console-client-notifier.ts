import { ClientNotifierPort } from '../../../application/ports/out/client-notifier.port';
import { ClearanceState } from '../../../domain/clearance';

export function describeClearance(state: ClearanceState): string {
  switch (state) {
    case 'awaiting-filing': return 'Waiting to be filed';
    case 'filed': return 'Filed with customs';
    case 'on-hold': return 'On hold, action needed';
    case 'refused': return 'Refused by customs';
  }
}

export class ConsoleClientNotifier implements ClientNotifierPort {
  async notifyFiling(importerId: string, shipmentId: string, state: ClearanceState): Promise<void> {
    console.log(`[to ${importerId}] shipment ${shipmentId}: ${describeClearance(state)}`);
  }
}
