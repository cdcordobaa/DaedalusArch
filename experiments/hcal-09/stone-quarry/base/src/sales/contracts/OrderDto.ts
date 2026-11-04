export interface OrderDto {
  readonly id: string;
  readonly customerId: string;
  readonly orderedTonnes: number;
  readonly deliveredTonnes: number;
}
