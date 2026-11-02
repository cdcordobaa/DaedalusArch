/** Our own list of costumes to be cleaned by hand. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  /** Costume ids in the order they were added. */
  list(): Promise<string[]>;
}
