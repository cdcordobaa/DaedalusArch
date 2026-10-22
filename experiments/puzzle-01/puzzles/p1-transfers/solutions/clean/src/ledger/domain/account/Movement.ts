export type MovementKind = 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';

export interface Movement {
  readonly kind: MovementKind;
  readonly cents: number;
  readonly counterpart: string | null;
}
