export type PartAvailability = 'in-stock' | 'delayed' | 'unavailable';
export type TimberQuality = 'premium' | 'standard' | 'economy';
export type DeliveryStage = 'preparing' | 'in-transit' | 'delivered' | 'cancelled';

export interface SupplyTicket {
  readonly supplyRef: string;
  readonly availability: PartAvailability;
  readonly arrivalDate: string;
  readonly quality: TimberQuality;
}
