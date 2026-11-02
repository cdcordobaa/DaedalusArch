import type { Piece } from '../../../domain/model/Piece';
import type { FiringProgress } from '../../../domain/model/FiringProgress';
import { StudioError } from '../../../domain/errors/StudioError';
import { FiringRules } from '../../../domain/services/FiringRules';
import type { DropOff, LoadView, PieceView, StudioPieces } from '../../ports/in/StudioPieces';
import type { PieceShelf } from '../../ports/out/storage/PieceShelf';
import type { KilnBookings } from '../../ports/out/kiln/KilnBookings';
import type { KilnReadings } from '../../ports/out/kiln/KilnReadings';

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
    return { pieceId: piece.pieceId, status: await this.shown(piece) };
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
    return { pieceId: p.pieceId, status: await this.shown(p) };
  }

  async withdrawPiece(pieceId: string): Promise<PieceView> {
    const p = await this.piece(pieceId);
    if (p.stage === 'withdrawn') throw new StudioError('piece ' + pieceId + ' was already taken back');
    if (p.stage === 'loaded' && (await this.progress(p)) !== 'waiting') throw new StudioError('The piece is already in the kiln.');
    const back: Piece = { ...p, stage: 'withdrawn' };
    await this.shelf.put(back);
    return { pieceId, status: await this.shown(back) };
  }

  async kilnLog(pieceId: string): Promise<string> {
    const p = await this.piece(pieceId);
    if (p.firingId === undefined) return 'Not in the kiln yet';
    const r = await this.readings.newest(p.firingId);
    return 'Kiln at ' + String(r.celsius) + ' C (' + r.phaseCode + '), read ' + r.takenAt;
  }

  private async progress(p: Piece): Promise<FiringProgress> {
    if (p.firingId === undefined) return 'waiting';
    return (await this.readings.newest(p.firingId)).progress;
  }

  private async shown(p: Piece): Promise<string> {
    if (p.stage === 'dropped') return 'DROPPED_OFF';
    if (p.stage === 'withdrawn') return 'WITHDRAWN';
    switch (await this.progress(p)) {
      case 'waiting': return 'WAITING';
      case 'firing': return 'IN_THE_KILN';
      case 'cooling': return 'COOLING_DOWN';
      case 'finished': return 'READY_FOR_PICKUP';
      case 'failed': return 'FIRING_FAILED';
    }
  }

  private async piece(pieceId: string): Promise<Piece> {
    const p = await this.shelf.find(pieceId);
    if (p === undefined) throw new StudioError('there is no piece ' + pieceId);
    return p;
  }
}
