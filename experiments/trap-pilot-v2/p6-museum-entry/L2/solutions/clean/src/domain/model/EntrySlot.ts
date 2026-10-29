/** A timed entry and how many visitors it can still take. */
export interface EntrySlot {
  readonly slot: string;
  readonly spacesLeft: number;
}
