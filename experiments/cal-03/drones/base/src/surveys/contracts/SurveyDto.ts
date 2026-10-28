export interface DeliverableInput {
  kind: 'orthomosaic' | 'point-cloud' | 'inspection-report';
  format: string;
}

export interface RequestSurveyCommand {
  clientEmail: string;
  siteName: string;
  hectares: number;
  windowStart: Date;
  windowEnd: Date;
  ratePerHectareCents: number;
  deliverables: DeliverableInput[];
}

export interface SurveyDto {
  id: string;
  siteName: string;
  status: string;
  hectares: number;
  priceCents: number;
  permitted: boolean;
  pilotId: string | null;
  deliverables: string[];
}
