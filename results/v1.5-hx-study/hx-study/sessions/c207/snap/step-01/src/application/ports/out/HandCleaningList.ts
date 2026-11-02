/** Our own list of costumes to be cleaned by hand, in the order they came back. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  costumeIds(): Promise<string[]>;
}
