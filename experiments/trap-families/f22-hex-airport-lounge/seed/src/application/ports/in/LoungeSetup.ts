export interface LoungeSetup {
  openLounge(name: string, airport: string, capacity: number, partners: readonly string[]): string;
  addPartner(airline: string, guestAllowance: number): void;
}
