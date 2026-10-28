/** What membership needs to know about pontoons. */
export interface PontoonLookup {
  exists(pontoonId: string): boolean;
  /** Takes the shortest free berth the boat fits; undefined, with nothing taken, when none fits. */
  reserveBerth(pontoonId: string, occupant: string, boatLengthM: number): { berth: number; lengthM: number } | undefined;
}
