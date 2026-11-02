/** The costumes the wardrobe cleans by hand, in the order they came back. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  costumeIds(): Promise<string[]>;
}
