// One-word cargo terms from two carrier declarations (reply and lane), beside the domain's own field.
export interface LoadSummary {
  readonly currency: string;
  readonly weight: number;
  readonly pallets: number;
  readonly origin: string;
  readonly destination: string;
  readonly handledBy: string;
}
