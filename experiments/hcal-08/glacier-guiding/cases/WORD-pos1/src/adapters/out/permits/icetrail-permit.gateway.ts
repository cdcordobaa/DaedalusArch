import { IceTrailClient, IceTrailError, PermitState } from 'icetrail-sdk';
import { PermitApplication, PermitRegistryPort } from '../../../application/ports/out/permit-registry.port';
import { PermitRegistryUnavailableError } from '../../../domain/errors';
import { PermitClearance, PermitOutcome } from '../../../domain/permit';

export class IceTrailPermitGateway implements PermitRegistryPort {
  private readonly client: IceTrailClient;

  constructor(apiKey: string) {
    this.client = new IceTrailClient({ api_key: apiKey });
  }

  async apply(application: PermitApplication): Promise<PermitClearance> {
    try {
      const res = await this.client.lodge({
        route_code: application.routeCode,
        party_size: application.partySize,
        ascent_date: application.ascentDate,
        lead_guide_licence: application.guideLicence,
        notes: '',
      });
      return { permitRef: res.permit_no, outcome: this.toOutcome(res.state), placesLeft: res.quota, warden: res.warden };
    } catch (e) {
      if (e instanceof IceTrailError) throw new PermitRegistryUnavailableError(`permit registry unavailable: ${e.message}`);
      throw e;
    }
  }

  private toOutcome(state: PermitState): PermitOutcome {
    if (state === 'GRANTED') return 'approved';
    if (state === 'LODGED' || state === 'VETTED' || state === 'DEFERRED') return 'pending';
    return 'refused';
  }
}
