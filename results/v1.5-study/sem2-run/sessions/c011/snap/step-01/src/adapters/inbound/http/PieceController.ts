import { StudioError } from '../../../domain/errors/StudioError';
import type { StudioPieces } from '../../../application/ports/in/StudioPieces';

export interface Reply {
  readonly code: number;
  readonly json: unknown;
}

/** The pickup page for students and the studio screens. */
export class PieceController {
  constructor(private readonly pieces: StudioPieces) {}

  async postPiece(body: Record<string, unknown>): Promise<Reply> {
    try {
      return ok(await this.pieces.dropOff({ pieceId: String(body.pieceId ?? ''), owner: String(body.owner ?? ''), title: String(body.title ?? ''), firing: String(body.firing ?? '') }));
    } catch (e) {
      return refused(e);
    }
  }

  async postFiring(body: { firing?: unknown; pieceIds?: unknown }): Promise<Reply> {
    try {
      const ids = Array.isArray(body.pieceIds) ? body.pieceIds.map(String) : [];
      return ok(await this.pieces.loadKiln(String(body.firing ?? ''), ids));
    } catch (e) {
      return refused(e);
    }
  }

  async getPiece(pieceId: string): Promise<Reply> {
    try {
      return ok(await this.pieces.pieceStatus(pieceId));
    } catch (e) {
      return refused(e);
    }
  }

  async getKilnLog(pieceId: string): Promise<Reply> {
    try {
      return ok({ line: await this.pieces.kilnLog(pieceId) });
    } catch (e) {
      return refused(e);
    }
  }
}

const ok = (json: unknown): Reply => ({ code: 200, json });
const refused = (e: unknown): Reply => {
  if (e instanceof StudioError) return { code: 422, json: { error: e.message } };
  return { code: 500, json: { error: e instanceof Error ? e.message : String(e) } };
};
