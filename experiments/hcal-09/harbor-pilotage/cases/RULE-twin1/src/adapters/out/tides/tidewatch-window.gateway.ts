import { TideServiceUnavailableError } from '@harbor/domain/errors';
import { TideSlot } from '@harbor/domain/tide-slot';
import { TidewatchClient, TidewatchError } from 'tidewatch-sdk';
import { SlotRequest, TideWindowPort } from '../../../application/ports/out/tide-window.port';

export class TidewatchWindowGateway implements TideWindowPort {
  private readonly client: TidewatchClient;

  constructor(accessToken: string) {
    this.client = new TidewatchClient({ access_token: accessToken });
  }

  async requestSlot(request: SlotRequest): Promise<TideSlot> {
    try {
      const res = await this.withRetry(() => this.client.requestWindow({ imo_number: request.vesselImo, draught_m: request.draughtMetres, eta_utc: request.etaUtc }));
      return {
        slotRef: res.berth_window_ref,
        opensAt: res.window_open_utc,
        closesAt: res.window_close_utc,
        underKeelMargin: res.ukc_margin_m,
      };
    } catch (e) {
      if (e instanceof TidewatchError) throw new TideServiceUnavailableError(`tide service unavailable: ${e.message}`);
      throw e;
    }
  }

  private async withRetry<T>(call: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 1; ; i++) {
      try {
        return await call();
      } catch (e) {
        if (!(e instanceof TidewatchError) || e.code !== 'TW_UNREACHABLE' || i >= attempts) throw e;
        await new Promise((resolve) => setTimeout(resolve, 200 * i));
      }
    }
  }
}
