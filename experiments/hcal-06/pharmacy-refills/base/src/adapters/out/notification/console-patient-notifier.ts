import { PatientNotifierPort } from '../../../application/ports/out/patient-notifier.port';
import { RefillState } from '../../../domain/refill';

export class ConsolePatientNotifier implements PatientNotifierPort {
  async notifyRefill(patientId: string, refillId: string, state: RefillState): Promise<void> {
    console.log(`[to patient ${patientId.slice(-4)}] refill ${refillId}: ${state}`);
  }
}
