import { PlacementStatus } from '../../../domain/placement-status';

export interface GrowerNotifierPort {
  notify(growerId: string, placementId: string, status: PlacementStatus): Promise<void>;
}
