import { DispatchStatus } from '../../../domain/dispatch-status';

export interface GardenCentreNotifierPort {
  notify(gardenCentreId: string, dispatchId: string, status: DispatchStatus): Promise<void>;
}
