import type { Piece } from '../../../domain/model/Piece';
import type { PieceShelf } from '../../../application/ports/out/storage/PieceShelf';

export class InMemoryPieceShelf implements PieceShelf {
  private readonly pieces: Piece[] = [];

  async put(piece: Piece): Promise<void> {
    const at = this.pieces.findIndex((p) => p.pieceId === piece.pieceId);
    if (at >= 0) this.pieces[at] = piece;
    else this.pieces.push(piece);
  }

  async find(pieceId: string): Promise<Piece | undefined> {
    return this.pieces.find((p) => p.pieceId === pieceId);
  }
}
