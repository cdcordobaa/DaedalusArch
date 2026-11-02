/** The costumes the wardrobe staff must clean by hand, in the order they came back. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  list(): Promise<string[]>;
}
