import { RecordConditionsPort } from '../../../application/ports/in/record-conditions.port';
import { BulletinDto } from './bulletin.dto';

export class IceTrailBulletinHandler {
  constructor(private readonly recordConditions: RecordConditionsPort) {}

  async handle(event: BulletinDto): Promise<{ affected: number }> {
    const affected = await this.recordConditions.record({ routeCode: event.route_code, band: event.band });
    return { affected };
  }
}
