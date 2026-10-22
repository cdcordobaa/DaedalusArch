/** One service line offered by the carrier. */
export interface CarrierRateLine {
  serviceCode: 'STD' | 'EXP' | 'FREIGHT';
  serviceName: string;
  amount: { value: string; currency: string };
}

export interface RatesPort {
  ratesFor(from: string, to: string, weightGrams: number): Promise<CarrierRateLine[]>;
}
