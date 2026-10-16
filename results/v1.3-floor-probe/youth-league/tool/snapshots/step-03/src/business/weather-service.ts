import { Fixture } from './entities';
import { FixtureRepository, PitchRepository, TeamRepository } from '../persistence/repositories';
import { WeatherNowClient } from '../persistence/weather-client';
import { FakeMailer } from '../persistence/fake-mailer';

export const HEAVY_RAIN_MM = 4;

export class WeatherService {
  constructor(
    private readonly fixtures: FixtureRepository,
    private readonly pitches: PitchRepository,
    private readonly teams: TeamRepository,
    private readonly weather: WeatherNowClient,
    private readonly mailer: FakeMailer,
  ) {}

  /** Checks the forecast of every fixture on the given match day (YYYY-MM-DD). */
  async checkMatchDay(date: string): Promise<Fixture[]> {
    const atRisk: Fixture[] = [];
    for (const f of this.fixtures.findAll().filter((x) => x.kickOff.startsWith(date) && !x.result)) {
      const pitch = this.pitches.findByName(f.pitch);
      if (!pitch) continue;
      const forecast = await this.weather.forecast(pitch.postcode, f.kickOff.slice(0, 13) + ':00');
      if (forecast.precipitationMm >= HEAVY_RAIN_MM && !f.atRisk) {
        const updated = this.fixtures.save({ ...f, atRisk: true });
        atRisk.push(updated);
        this.notifyCoaches(updated, forecast.summary);
      }
    }
    return atRisk;
  }

  private notifyCoaches(f: Fixture, summary: string): void {
    const home = this.teams.findById(f.homeTeamId);
    const away = this.teams.findById(f.awayTeamId);
    for (const team of [home, away]) {
      if (!team) continue;
      this.mailer.send(
        team.coachEmail,
        `Fixture at risk: ${home?.name} v ${away?.name}`,
        `Heavy rain is forecast for the kick-off at ${f.kickOff} on ${f.pitch} (${summary}). The league may postpone the fixture.`,
      );
    }
  }
}
