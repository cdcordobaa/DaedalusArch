/** The costumes waiting to be cleaned by hand, in the order they came back. */
export interface HandCleaningList {
  add(costumeId: string): Promise<void>;
  all(): Promise<string[]>;
}
