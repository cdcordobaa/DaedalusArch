import { PatientNotifierPort } from '../../../application/ports/out/patient-notifier.port';
import { RefillState } from '../../../domain/refill';

export function maskPatientId(id: string): string {
  return id.length <= 4 ? '****' : `****${id.slice(-4)}`;
}

export class ConsolePatientNotifier implements PatientNotifierPort {
  async notifyRefill(patientId: string, refillId: string, state: RefillState): Promise<void> {
    console.log(`[to patient ${maskPatientId(patientId)}] refill ${refillId}: ${state}`);
  }
}
