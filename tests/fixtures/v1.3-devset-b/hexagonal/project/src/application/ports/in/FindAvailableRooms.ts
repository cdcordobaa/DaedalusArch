export interface AvailableRoom {
  roomId: string;
  number: string;
  nightlyRateCents: number;
}

export interface FindAvailableRooms {
  find(checkIn: string, checkOut: string, guests: number): Promise<AvailableRoom[]>;
}
