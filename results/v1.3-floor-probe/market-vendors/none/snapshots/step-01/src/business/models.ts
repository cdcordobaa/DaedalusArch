export interface MarketDay {
  id: string;
  date: string; // YYYY-MM-DD
}

export type PitchSize = 'small' | 'medium' | 'large';

export interface Pitch {
  number: number;
  size: PitchSize;
  hasPower: boolean;
}

export interface Vendor {
  id: string;
  businessName: string;
  contact: string;
  products: string[];
}

export interface Booking {
  id: string;
  marketDayId: string;
  pitchNumber: number;
  vendorId: string;
}

export interface ReaderLink {
  readerId: string;
  marketDayId: string;
  vendorId: string;
}

export interface CardSale {
  id: string;
  readerId: string;
  vendorId: string;
  marketDayId: string;
  amount: number;
  time: string;
  provider: 'paylane';
}

export class BusinessError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}
