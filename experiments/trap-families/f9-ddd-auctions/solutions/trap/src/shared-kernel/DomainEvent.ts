/** Something that happened, written together with the change that caused it. */
export interface DomainEvent {
  readonly type: string;
}
