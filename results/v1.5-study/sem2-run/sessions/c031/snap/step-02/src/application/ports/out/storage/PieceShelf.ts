import type { Piece } from '../../../../domain/model/Piece';

export interface PieceShelf {
  put(piece: Piece): Promise<void>;
  find(pieceId: string): Promise<Piece | undefined>;
}
