import { RecordConditionsPort } from '../../../application/ports/in/record-conditions.port';
import { RouteCondition } from '../../../domain/route-condition';
import { BulletinDto } from './bulletin.dto';

export class IceTrailBulletinHandler {
  constructor(private readonly recordConditions: RecordConditionsPort) {}

  async handle(event: BulletinDto): Promise<{ affected: number }> {
    const condition = this.toCondition(event.band, event.serac);
    const affected = await this.recordConditions.record({ routeCode: event.route_code, condition });
    return { affected };
  }

  private toCondition(band: string, serac: boolean): RouteCondition {
    switch (band) {
      case 'CALM':
      case 'BREEZY':
        return serac ? 'caution' : 'open';
      case 'WATCH':
        return 'caution';
      default:
        return 'closed';
    }
  }
}
