import { LockboxClient, LockboxTimeout } from 'lockbox-sdk';
import { LockerDoorPort } from '../../../application/ports/out/locker-door.port';
import { LockerUnavailableError } from '../../../domain/errors';

export class LockboxDoorGateway implements LockerDoorPort {
  private readonly client: LockboxClient;

  constructor(token: string) {
    this.client = new LockboxClient({ token });
  }

  async open(lockerId: string): Promise<void> {
    try {
      const report = await this.client.openDoor(lockerId);
      if (report.door_state === 'DOOR_JAMMED') throw new LockerUnavailableError(`locker ${lockerId} is jammed`);
    } catch (e) {
      if (e instanceof LockboxTimeout) throw new LockerUnavailableError(`locker ${lockerId} did not answer`);
      throw e;
    }
  }
}
