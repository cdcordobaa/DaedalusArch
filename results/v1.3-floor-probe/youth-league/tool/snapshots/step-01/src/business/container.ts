import { FixtureRepository, PlayerRepository, TeamRepository } from '../persistence/repositories';
import { TeamService } from './team-service';
import { FixtureService } from './fixture-service';

/** Builds the business services with their persistence. */
export function createServices() {
  const teamRepo = new TeamRepository();
  const playerRepo = new PlayerRepository();
  const fixtureRepo = new FixtureRepository();
  return {
    teams: new TeamService(teamRepo, playerRepo),
    fixtures: new FixtureService(fixtureRepo, teamRepo),
  };
}
