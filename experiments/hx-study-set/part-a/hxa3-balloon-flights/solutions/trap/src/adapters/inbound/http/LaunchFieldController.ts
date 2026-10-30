import type { FlySeats } from '../../../application/ports/in/FlySeats';
import type { VoucherDesk } from '../../../application/ports/in/VoucherDesk';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** The booking office and the launch field tablet. */
export class LaunchFieldController {
  constructor(
    private readonly flights: FlySeats,
    private readonly desk: VoucherDesk,
  ) {}

  postFlight(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.flights.schedule(String(body.flightId ?? ''), String(body.day ?? '')));
  }

  postSeat(flightId: string, body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.flights.requestSeat(flightId, String(body.passenger ?? ''), String(body.voucherCode ?? '')));
  }

  postBoarding(flightId: string, body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.flights.board(flightId, String(body.passenger ?? '')));
  }

  getManifest(flightId: string): Promise<HttpResponse> {
    return this.run(() => this.flights.manifest(flightId));
  }

  getVoucherLine(code: string): Promise<HttpResponse> {
    return this.run(() => this.desk.line(code));
  }

  postExtension(code: string): Promise<HttpResponse> {
    return this.run(() => this.desk.extend(code));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
