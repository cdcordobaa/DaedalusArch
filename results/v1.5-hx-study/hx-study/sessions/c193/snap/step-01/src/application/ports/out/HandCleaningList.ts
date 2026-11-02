/** The costumes we must clean by hand, in the order they came back. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  costumeIds(): Promise<string[]>;
}
