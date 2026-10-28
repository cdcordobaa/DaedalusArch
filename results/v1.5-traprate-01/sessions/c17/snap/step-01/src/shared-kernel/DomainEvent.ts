/** A fact one part of the market recorded, for other parts to react to after it is stored. */
export interface DomainEvent {
  readonly type: string;
}
