// Three one-word cargo terms, all fields of the carrier reply: ordinary vocabulary, not the carrier's coinage.
export interface CargoTotals {
  readonly currency: string;
  readonly weight: number;
  readonly pallets: number;
}
