import { RefillState } from '../../../domain/refill';

export interface PatientNotifierPort {
  notifyRefill(patientId: string, refillId: string, state: RefillState): Promise<void>;
}
