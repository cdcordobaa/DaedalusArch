import { conditionFromSky } from '../domain/sky-reading';
import { LogSkyCommand, LogSkyPort } from './ports/in/log-sky.port';
import { RecordConditionsPort } from './ports/in/record-conditions.port';

export class LogSkyUseCase implements LogSkyPort {
  constructor(private readonly conditions: RecordConditionsPort) {}

  async log(command: LogSkyCommand): Promise<number> {
    return this.conditions.record({ routeCode: command.routeCode, condition: conditionFromSky(command.reading) });
  }
}
