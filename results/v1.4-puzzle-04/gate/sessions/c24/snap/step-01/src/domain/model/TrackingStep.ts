export interface TrackingStep {
  readonly status: 'picked up' | 'in transit' | 'out for delivery' | 'delivered';
  readonly at: string;
}
