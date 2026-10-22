/** Shared kernel: how both contexts refer to a customer. A reference, not an entity of either context. */
export interface CustomerRef {
  readonly id: string;
  readonly displayName: string;
}
