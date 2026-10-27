import type { RiderPositions } from '../../../application/ports/out/RiderPositions';
import type { PositionFix } from '../../../domain/whereabouts';
import type { TrackpointClient } from './TrackpointClient';

/** Trackpoint's fixes, translated: 1e-7 degree integers to degrees, epoch milliseconds to a date. */
export class TrackpointPositions implements RiderPositions {
  constructor(private readonly client: TrackpointClient) {}

  async latestFix(trackerId: string): Promise<PositionFix | null> {
    const fix = await this.client.lastFix(trackerId);
    if (fix === null) return null;
    return { at: { lat: fix.latE7 / 1e7, lng: fix.lonE7 / 1e7 }, takenAt: new Date(fix.fixedAtMs) };
  }
}
