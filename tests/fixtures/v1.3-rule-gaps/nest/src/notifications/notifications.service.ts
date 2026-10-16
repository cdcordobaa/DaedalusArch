import { Injectable } from '@nestjs/common';
import { ClockService } from '../shared/clock.service';

// look-alike (nest-provider-not-visible): ClockService reaches NotificationsModule through CoreModule's re-export.
@Injectable()
export class NotificationsService {
  constructor(private readonly clock: ClockService) {}
  stamp(): number {
    return this.clock.now();
  }
}
