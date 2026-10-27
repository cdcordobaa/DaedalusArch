export interface LoungeSetup {
  openLounge(name: string, airport: string, capacity: number, partners: readonly string[]): string;
  /** `guestCutoff`: the local hour from which no guests are admitted until 05:00, or null for none. */
  addPartner(airline: string, guestAllowance: number, guestCutoff?: number | null): void;
}
