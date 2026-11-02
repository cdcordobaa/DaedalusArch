import type { Piece } from '../../../domain/model/Piece';
import { StudioError } from '../../../domain/errors/StudioError';
import { FiringRules } from '../../../domain/services/FiringRules';
import type { DropOff, LoadView, PieceView, StudioPieces } from '../../ports/in/StudioPieces';
import type { PieceShelf } from '../../ports/out/storage/PieceShelf';
import type { KilnBookings } from '../../ports/out/kiln/KilnBookings';
import type { KilnReadings } from '../../ports/out/kiln/KilnReadings';

/** The kiln's condition. */
enum KilnCondition { Idle = 'idle', Venting = 'venting', Rising = 'rising', Steady = 'steady', Falling = 'falling', Cold = 'cold', Tripped = 'tripped' }

function conditionOf(phaseCode: string): KilnCondition {
  const code = phaseCode.toUpperCase();
  if (code === 'SCHEDULED') return KilnCondition.Idle;
  if (code === 'CANDLING') return KilnCondition.Venting;
  if (code === 'RAMPING') return KilnCondition.Rising;
  if (code === 'HOLDING') return KilnCondition.Steady;
  if (code === 'COOLING') return KilnCondition.Falling;
  if (code === 'COMPLETE') return KilnCondition.Cold;
  return KilnCondition.Tripped;
}

export class PieceService implements StudioPieces {
  constructor(
    private readonly shelf: PieceShelf,
    private readonly bookings: KilnBookings,
    private readonly readings: KilnReadings,
    private readonly rules: FiringRules = new FiringRules(),
  ) {}

  async dropOff(r: DropOff): Promise<PieceView> {
    if ((await this.shelf.find(r.pieceId)) !== undefined) throw new StudioError('piece ' + r.pieceId + ' is already here');
    const piece: Piece = {
      pieceId: r.pieceId,
      owner: this.rules.named(r.owner, 'owner'),
      title: this.rules.named(r.title, 'title'),
      firing: this.rules.firing(r.firing),
      stage: 'dropped',
    };
    await this.shelf.put(piece);
    return { pieceId: piece.pieceId, status: 'DROPPED_OFF' };
  }

  async loadKiln(rawFiring: string, pieceIds: readonly string[]): Promise<LoadView> {
    const firing = this.rules.firing(rawFiring);
    if (pieceIds.length === 0) throw new StudioError('a firing needs at least one piece');
    const pieces: Piece[] = [];
    for (const id of pieceIds) {
      const p = await this.piece(id);
      if (p.stage !== 'dropped') throw new StudioError('piece ' + id + ' is not waiting for a firing');
      if (p.firing !== firing) throw new StudioError('piece ' + id + ' needs a ' + p.firing + ' firing');
      pieces.push(p);
    }
    const label = 'Clay Corner ' + firing;
    const firingId = await this.bookings.schedule(label, firing, this.rules.peakCelsius(firing), this.rules.shelves(pieces.length));
    for (const p of pieces) await this.shelf.put({ ...p, firingId, stage: 'loaded' });
    return { firingId, pieces: pieces.length };
  }

  async pieceStatus(pieceId: string): Promise<PieceView> {
    const p = await this.piece(pieceId);
    if (p.stage === 'dropped') return { pieceId, status: 'DROPPED_OFF' };
    if (p.stage === 'withdrawn' || p.firingId === undefined) return { pieceId, status: 'WITHDRAWN' };
    const c = conditionOf((await this.readings.newest(p.firingId)).phaseCode);
    switch (c) {
      case KilnCondition.Idle:
      case KilnCondition.Venting:
        return { pieceId, status: 'WAITING' };
      case KilnCondition.Rising:
      case KilnCondition.Steady:
        return { pieceId, status: 'IN_THE_KILN' };
      case KilnCondition.Falling: return { pieceId, status: 'COOLING_DOWN' };
      case KilnCondition.Cold: return { pieceId, status: 'READY_FOR_PICKUP' };
      case KilnCondition.Tripped: return { pieceId, status: 'FIRING_FAILED' };
    }
  }

  async withdrawPiece(pieceId: string): Promise<PieceView> {
    const p = await this.piece(pieceId);
    if (p.stage === 'withdrawn') throw new StudioError('piece ' + pieceId + ' was already taken back');
    if (p.stage === 'loaded' && p.firingId !== undefined) {
      const c = conditionOf((await this.readings.newest(p.firingId)).phaseCode);
      if (c !== KilnCondition.Idle && c !== KilnCondition.Venting) throw new StudioError('The piece is already in the kiln.');
    }
    await this.shelf.put({ ...p, stage: 'withdrawn' });
    return { pieceId, status: 'WITHDRAWN' };
  }

  async kilnLog(pieceId: string): Promise<string> {
    const p = await this.piece(pieceId);
    if (p.firingId === undefined) return 'Not in the kiln yet';
    const r = await this.readings.newest(p.firingId);
    return 'Kiln at ' + String(r.celsius) + ' C (' + r.phaseCode + '), read ' + r.takenAt;
  }

  private async piece(pieceId: string): Promise<Piece> {
    const p = await this.shelf.find(pieceId);
    if (p === undefined) throw new StudioError('there is no piece ' + pieceId);
    return p;
  }
}
