import { StudioError } from '../errors/StudioError';
import type { FiringProgress } from '../model/KilnReading';
import type { Piece } from '../model/Piece';

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

  shelves(pieceCount: number): number {
    return Math.max(1, Math.ceil(pieceCount / PIECES_PER_SHELF));
  }

  /** A piece can be taken back until its firing has started. */
  canWithdraw(progress: FiringProgress): boolean {
    return progress === 'waiting';
  }

  /** The pickup status a student sees for a piece in a firing. */
  statusForProgress(progress: FiringProgress): string {
    switch (progress) {
      case 'waiting':
        return 'WAITING';
      case 'in_kiln':
        return 'IN_THE_KILN';
      case 'cooling':
        return 'COOLING_DOWN';
      case 'complete':
        return 'READY_FOR_PICKUP';
      case 'faulted':
        return 'FIRING_FAILED';
    }
  }
}
