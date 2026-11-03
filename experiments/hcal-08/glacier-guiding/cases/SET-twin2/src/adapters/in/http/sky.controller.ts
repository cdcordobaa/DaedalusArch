import { LogSkyPort } from '../../../application/ports/in/log-sky.port';
import { SkyReading } from '../../../domain/sky-reading';

export class SkyController {
  constructor(private readonly logSky: LogSkyPort) {}

  async postReading(params: { routeCode: string; reading: SkyReading }): Promise<{ affected: number }> {
    return { affected: await this.logSky.log(params) };
  }
}
