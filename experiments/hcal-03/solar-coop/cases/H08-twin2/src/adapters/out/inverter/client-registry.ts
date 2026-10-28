import { InverterApiClient } from './inverter-api.client';

export class InverterClientRegistry {
  private static instance: InverterClientRegistry | null = null;
  private client: InverterApiClient | null = null;

  static getInstance(): InverterClientRegistry {
    InverterClientRegistry.instance ??= new InverterClientRegistry();
    return InverterClientRegistry.instance;
  }

  set(client: InverterApiClient): void {
    this.client = client;
  }

  require(): InverterApiClient {
    if (!this.client) throw new Error('inverter client not registered');
    return this.client;
  }
}
