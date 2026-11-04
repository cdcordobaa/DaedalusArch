import { TideServiceUnavailableError } from '@harbor/domain/errors';
import { TideSlot } from '@harbor/domain/tide-slot';
import { TideWindowResponse, TidewatchClient, TidewatchError } from 'tidewatch-sdk';
import { SlotRequest, TideWindowPort } from '../../../application/ports/out/tide-window.port';

const SLOT_FIELDS = {
  berth_window_ref: 'slotRef',
  window_open_utc: 'opensAt',
  window_close_utc: 'closesAt',
  ukc_margin_m: 'underKeelMargin',
} as const satisfies Partial<Record<keyof TideWindowResponse, keyof TideSlot>>;

export class TidewatchWindowGateway implements TideWindowPort {
  private readonly client: TidewatchClient;

  constructor(accessToken: string) {
    this.client = new TidewatchClient({ access_token: accessToken });
  }

  async requestSlot(request: SlotRequest): Promise<TideSlot> {
    try {
      const res = await this.client.requestWindow({ imo_number: request.vesselImo, draught_m: request.draughtMetres, eta_utc: request.etaUtc });
      const slot: Record<string, string | number> = {};
      for (const [from, to] of Object.entries(SLOT_FIELDS)) slot[to] = res[from as keyof typeof SLOT_FIELDS];
      return slot as unknown as TideSlot;
    } catch (e) {
      if (e instanceof TidewatchError) throw new TideServiceUnavailableError(`tide service unavailable: ${e.message}`);
      throw e;
    }
  }
}
