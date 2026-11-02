/** Costumes the wardrobe must clean by hand, in the order they came back. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  list(): Promise<string[]>;
}
