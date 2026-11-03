export type PartAvailability = 'in-stock' | 'backorder' | 'unavailable';
export type DeliveryStage = 'preparing' | 'in-transit' | 'delivered' | 'cancelled';

export interface SupplyTicket {
  readonly supplyRef: string;
  readonly availability: PartAvailability;
  readonly arrivalDate: string;
}
