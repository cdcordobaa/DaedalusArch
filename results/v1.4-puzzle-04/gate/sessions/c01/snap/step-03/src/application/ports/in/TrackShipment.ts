import type { TrackingStep } from '../../../domain/model/TrackingStep';

export interface TrackShipment {
  track(trackingNumber: string): Promise<TrackingStep[]>;
}
