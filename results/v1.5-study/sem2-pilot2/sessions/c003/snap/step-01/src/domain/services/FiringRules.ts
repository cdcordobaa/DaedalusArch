import { StudioError } from '../errors/StudioError';
import type { Piece } from '../model/Piece';
import type { KilnStage } from '../model/KilnReading';

export type PickupStatus = 'DROPPED_OFF' | 'WAITING' | 'IN_THE_KILN' | 'READY_FOR_PICKUP' | 'FIRING_FAILED';

const PIECES_PER_SHELF = 4;

/** What the studio accepts for firing and how a firing is set up. */
export class FiringRules {
  named(value: string, what: string): string {
    const v = value.trim();
    if (v === '') throw new StudioError(what + ' is required');
    if (v.length > 60) throw new StudioError(what + ' has at most 60 characters');
    return v;
  }

  firing(raw: string): Piece['firing'] {
    if (raw !== 'bisque' && raw !== 'glaze') throw new StudioError('a firing is bisque or glaze');
    return raw;
  }

  peakCelsius(firing: Piece['firing']): number {
    return firing === 'glaze' ? 1240 : 1000;
  }

  pickupStatus(stage: KilnStage): PickupStatus {
    switch (stage) {
      case 'queued':
        return 'WAITING';
      case 'heating':
        return 'IN_THE_KILN';
      case 'finished':
        return 'READY_FOR_PICKUP';
      case 'failed':
        return 'FIRING_FAILED';
    }
  }

  shelves(pieceCount: number): number {
    return Math.max(1, Math.ceil(pieceCount / PIECES_PER_SHELF));
  }
}
