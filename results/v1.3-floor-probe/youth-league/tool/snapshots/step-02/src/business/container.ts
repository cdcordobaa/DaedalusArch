import { FixtureRepository, PitchRepository, PlayerRepository, TeamRepository } from '../persistence/repositories';
import { WeatherNowClient } from '../persistence/weather-client';
import { FakeMailer } from '../persistence/fake-mailer';
import { TeamService } from './team-service';
import { FixtureService } from './fixture-service';
import { WeatherService } from './weather-service';

/** Builds the business services with their persistence. */
export function createServices() {
  const teamRepo = new TeamRepository();
  const playerRepo = new PlayerRepository();
  const fixtureRepo = new FixtureRepository();
  const pitchRepo = new PitchRepository();
  const mailer = new FakeMailer();
  return {
    mailer,
    teams: new TeamService(teamRepo, playerRepo),
    fixtures: new FixtureService(fixtureRepo, teamRepo, pitchRepo),
    weather: new WeatherService(fixtureRepo, pitchRepo, teamRepo, new WeatherNowClient(), mailer),
  };
}
