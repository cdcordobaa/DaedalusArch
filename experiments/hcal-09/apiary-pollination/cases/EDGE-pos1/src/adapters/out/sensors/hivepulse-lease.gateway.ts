import { LeaseRequest, SensorLeasePort } from '@apiary/application/ports/out/sensor-lease.port';
import { SensorsUnavailableError } from '@apiary/domain/errors';
import { SensorCover } from '@apiary/domain/sensor-cover';
import { HivepulseClient, HivepulseError } from 'hivepulse-sdk';

export class HivepulseLeaseGateway implements SensorLeasePort {
  private readonly client: HivepulseClient;

  constructor(workspace: string) {
    this.client = new HivepulseClient({ workspace });
  }

  private readonly leases = new Map<string, import('hivepulse-sdk').SensorLease>();

  async details(leaseRef: string) {
    return this.leases.get(leaseRef) ?? null;
  }

  async lease(request: LeaseRequest): Promise<SensorCover> {
    try {
      const res = await this.client.leaseSensors({ yard_code: request.yardCode, unit_count: request.units, start_date: new Date().toISOString().slice(0, 10) });
      this.leases.set(res.lease_id, res);
      return { leaseRef: res.lease_id, active: res.lease_state === 'ACTIVE', units: res.unit_count };
    } catch (e) {
      if (e instanceof HivepulseError) throw new SensorsUnavailableError(`sensor leasing unavailable: ${e.message}`);
      throw e;
    }
  }
}
