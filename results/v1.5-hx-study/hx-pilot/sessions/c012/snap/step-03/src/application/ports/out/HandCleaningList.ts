/** Costumes the cleaners would not take, to be cleaned by hand. */
export interface HandCleaningList {
  /** Adds a costume to the end of the list. */
  add(costumeId: string): Promise<void>;
  /** The costume ids, in the order they were added. */
  list(): Promise<string[]>;
}
