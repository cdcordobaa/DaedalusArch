/** The costumes our own staff clean by hand, kept in the order they came back. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  costumeIds(): Promise<string[]>;
}
