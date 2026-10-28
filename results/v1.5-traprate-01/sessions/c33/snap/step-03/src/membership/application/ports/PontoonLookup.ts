/** What membership needs to know about pontoons. */
export interface PontoonLookup {
  exists(pontoonId: string): boolean;
  /** Takes the shortest free berth the boat fits, at once; undefined when none fits. */
  reserveBerth(pontoonId: string, occupant: string, boatLengthM: number): { berth: number; lengthM: number } | undefined;
  /** Frees the berth the occupant holds, at once. */
  releaseBerth(pontoonId: string, occupant: string): void;
}
