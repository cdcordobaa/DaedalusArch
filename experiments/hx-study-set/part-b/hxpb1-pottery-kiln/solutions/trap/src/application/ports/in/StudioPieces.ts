export interface DropOff {
  readonly pieceId: string;
  readonly owner: string;
  readonly title: string;
  readonly firing: string;
}

export interface PieceView {
  readonly pieceId: string;
  readonly status: string;
}

export interface LoadView {
  readonly firingId: string;
  readonly pieces: number;
}

export interface StudioPieces {
  dropOff(request: DropOff): Promise<PieceView>;
  loadKiln(firing: string, pieceIds: readonly string[]): Promise<LoadView>;
  pieceStatus(pieceId: string): Promise<PieceView>;
  withdrawPiece(pieceId: string): Promise<PieceView>;
  kilnLog(pieceId: string): Promise<string>;
}
