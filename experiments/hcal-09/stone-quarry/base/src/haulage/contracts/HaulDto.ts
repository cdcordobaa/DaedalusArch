export interface HaulDto {
  readonly id: string;
  readonly truckId: string;
  readonly orderId: string;
  readonly ticketNo: string;
  readonly tonnes: number;
  readonly shiftDate: string;
}
