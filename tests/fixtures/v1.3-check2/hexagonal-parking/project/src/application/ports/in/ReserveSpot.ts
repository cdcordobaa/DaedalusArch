export interface ReservationReceipt {
  reservationId: string;
  spot: string;
  priceCents: number;
}

export interface ReserveSpot {
  reserve(plate: string, from: Date, hours: number, electric: boolean): Promise<ReservationReceipt>;
}
