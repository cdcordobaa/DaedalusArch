import { RecordConditionsPort } from '../../../application/ports/in/record-conditions.port';
import { RouteCondition } from '../../../domain/route-condition';
import { BulletinDto } from './bulletin.dto';

const CONDITION_BY_BAND: Record<string, RouteCondition> = {
  CALM: 'open',
  BREEZY: 'open',
  WATCH: 'caution',
  SURGE: 'closed',
  CLOSURE: 'closed',
};

export class IceTrailBulletinHandler {
  constructor(private readonly recordConditions: RecordConditionsPort) {}

  async handle(event: BulletinDto): Promise<{ affected: number }> {
    const condition = CONDITION_BY_BAND[event.band] ?? 'closed';
    const affected = await this.recordConditions.record({ routeCode: event.route_code, condition });
    return { affected };
  }
}
