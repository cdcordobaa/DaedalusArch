import { PatientNotifierPort } from '../../../application/ports/out/patient-notifier.port';
import { RefillState } from '../../../domain/refill';
import { maskPatientId } from '../shared/patient-redaction';

export class ConsolePatientNotifier implements PatientNotifierPort {
  async notifyRefill(patientId: string, refillId: string, state: RefillState): Promise<void> {
    console.log(`[to patient ${maskPatientId(patientId)}] refill ${refillId}: ${state}`);
  }
}
