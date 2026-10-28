import { InverterMonitoring } from '../../../application/ports/out/inverter-monitoring.port';
import { InverterClientRegistry } from './client-registry';

export class InverterApiGateway implements InverterMonitoring {
  async monthlyProductionKwh(period: string): Promise<number> {
    const client = InverterClientRegistry.getInstance().require();
    const reading = await client.fetchReading(period);
    return reading.kwh;
  }
}
