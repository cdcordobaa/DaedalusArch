/** A rated player as the congress needs to know them. */
export interface PlayerRecord {
  readonly federationId: string;
  readonly name: string;
  readonly rating: number;
}
