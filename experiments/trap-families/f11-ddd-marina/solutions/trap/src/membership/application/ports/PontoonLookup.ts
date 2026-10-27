/** What membership needs to know about pontoons. */
export interface PontoonLookup {
  exists(pontoonId: string): boolean;
  /** Takes the best free berth for the boat, or null when none fits or the pontoon is closed. */
  take(pontoonId: string, memberId: string, boatLengthM: number): { berth: number; lengthM: number } | null;
  release(pontoonId: string, memberId: string): void;
}
