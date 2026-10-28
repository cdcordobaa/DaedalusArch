import { EndTripPort } from '../../../application/ports/in/end-trip.port';
import { LockScooterPort } from '../../../application/ports/in/lock-scooter.port';
import { StartTripPort } from '../../../application/ports/in/start-trip.port';
import { UnlockScooterPort } from '../../../application/ports/in/unlock-scooter.port';
import { EndTripRequestDto, EndTripResponseDto, StartTripRequestDto } from './trip.dto';

export class TripController {
  constructor(
    private readonly unlocker: UnlockScooterPort,
    private readonly starter: StartTripPort,
    private readonly locker: LockScooterPort,
    private readonly ender: EndTripPort,
  ) {}
  async postStart(body: StartTripRequestDto): Promise<{ tripId: string }> {
    await this.unlocker.unlock(body.scooterId);
    return { tripId: await this.starter.start(body.riderId, body.scooterId) };
  }
  async postEnd(body: EndTripRequestDto): Promise<EndTripResponseDto> {
    await this.locker.lock(body.scooterId, body.batteryPercent);
    return { result: await this.ender.end(body.tripId, body.cardToken) };
  }
}
