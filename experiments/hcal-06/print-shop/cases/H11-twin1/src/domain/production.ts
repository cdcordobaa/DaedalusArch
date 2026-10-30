export type ProductionOutcome = 'accepted' | 'artwork-rejected';
export type ArtworkIssue = 'image-quality' | 'layout';

export interface ProductionTicket {
  readonly productionRef: string;
  readonly outcome: ProductionOutcome;
  readonly artworkIssues: readonly ArtworkIssue[];
  readonly unitCostCents: number;
}

export interface ProductionProgress {
  readonly productionRef: string;
  readonly stillInProduction: boolean;
  readonly trackingRef: string | null;
  readonly expectedShipDay: string;
}
