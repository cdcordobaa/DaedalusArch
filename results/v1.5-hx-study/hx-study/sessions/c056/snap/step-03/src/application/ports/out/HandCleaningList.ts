/** Costumes the cleaners would not take, to be cleaned by hand. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  /** Costume ids in the order they came back. */
  list(): Promise<string[]>;
}
