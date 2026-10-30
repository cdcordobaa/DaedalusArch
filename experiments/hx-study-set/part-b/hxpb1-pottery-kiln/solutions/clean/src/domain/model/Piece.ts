/** A student's piece left at the studio for firing. */
export interface Piece {
  readonly pieceId: string;
  readonly owner: string;
  readonly title: string;
  /** Raw clay goes in a bisque firing, glazed ware in a glaze firing. */
  readonly firing: 'bisque' | 'glaze';
  readonly firingId?: string;
  readonly stage: 'dropped' | 'loaded' | 'withdrawn';
}
