import { SkyReading } from '../../../domain/sky-reading';

export interface LogSkyCommand {
  readonly routeCode: string;
  readonly reading: SkyReading;
}

export interface LogSkyPort {
  log(command: LogSkyCommand): Promise<number>;
}
