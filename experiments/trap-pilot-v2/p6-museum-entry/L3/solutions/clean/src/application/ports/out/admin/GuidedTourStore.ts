import type { GuidedTour } from '../../../../domain/model/admin/GuidedTour';

export interface GuidedTourStore {
  add(item: GuidedTour): Promise<void>;
  all(): Promise<GuidedTour[]>;
}
