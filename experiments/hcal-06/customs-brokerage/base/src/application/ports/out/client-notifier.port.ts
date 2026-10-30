import { ClearanceState } from '../../../domain/clearance';

export interface ClientNotifierPort {
  notifyFiling(importerId: string, shipmentId: string, state: ClearanceState): Promise<void>;
}
