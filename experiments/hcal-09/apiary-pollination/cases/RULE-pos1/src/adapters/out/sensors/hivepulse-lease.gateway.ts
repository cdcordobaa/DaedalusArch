import { LeaseRequest, SensorLeasePort } from '@apiary/application/ports/out/sensor-lease.port';
import { SensorsUnavailableError } from '@apiary/domain/errors';
import { SensorCover } from '@apiary/domain/sensor-cover';
import { HivepulseClient, HivepulseError } from 'hivepulse-sdk';

export class HivepulseLeaseGateway implements SensorLeasePort {
  private readonly client: HivepulseClient;

  constructor(workspace: string) {
    this.client = new HivepulseClient({ workspace });
  }

  async lease(request: LeaseRequest): Promise<SensorCover> {
    try {
      const res = await this.client.leaseSensors({ yard_code: request.yardCode, unit_count: Math.max(2, Math.ceil(request.hiveCount / 4)), start_date: new Date().toISOString().slice(0, 10) });
      return { leaseRef: res.lease_id, active: res.lease_state === 'ACTIVE', units: res.unit_count };
    } catch (e) {
      if (e instanceof HivepulseError) throw new SensorsUnavailableError(`sensor leasing unavailable: ${e.message}`);
      throw e;
    }
  }
}
