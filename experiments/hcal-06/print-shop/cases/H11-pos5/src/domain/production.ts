export type ProductionOutcome = 'accepted' | 'artwork-rejected';
export type ArtworkIssue = 'image-quality' | 'layout';

export interface ProductionTicket {
  readonly productionRef: string;
  readonly outcome: ProductionOutcome;
  readonly artworkIssues: readonly ArtworkIssue[];
  readonly unitCostCents: number;
}

export type ProductionSnapshot = {
  readonly job_id: string;
  readonly job_status: string;
  readonly carrier_tracking_id: string | null;
  readonly estimated_ship_date: string;
};
