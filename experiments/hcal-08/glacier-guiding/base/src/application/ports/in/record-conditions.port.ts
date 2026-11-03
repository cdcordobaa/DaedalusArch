import { RouteCondition } from '../../../domain/route-condition';

export interface RecordConditionsCommand {
  readonly routeCode: string;
  readonly condition: RouteCondition;
}

export interface RecordConditionsPort {
  record(command: RecordConditionsCommand): Promise<number>;
}
