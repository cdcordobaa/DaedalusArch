import { InverterMonitoring } from '../../../application/ports/out/inverter-monitoring.port';
import { InverterApiClient } from './inverter-api.client';

export class InverterApiGateway implements InverterMonitoring {
  constructor(private readonly client: InverterApiClient) {}
  async monthlyProductionKwh(period: string): Promise<number> {
    const reading = await this.client.fetchReading(period);
    return reading.kwh;
  }
}
