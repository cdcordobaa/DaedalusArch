export interface InverterApiReading {
  readonly period: string;
  readonly kwh: number;
}

export class InverterApiClient {
  constructor(private readonly baseUrl: string) {}
  async fetchReading(period: string): Promise<InverterApiReading> {
    return { period, kwh: this.baseUrl.length * 100 };
  }
}
