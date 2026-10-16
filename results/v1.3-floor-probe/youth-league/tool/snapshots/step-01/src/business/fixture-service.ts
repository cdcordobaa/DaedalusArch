import { randomUUID } from 'node:crypto';
import { Fixture, NotFoundError, ValidationError } from './entities';
import { overlaps, sameDay } from './rules';
import { FixtureRepository, TeamRepository } from '../persistence/repositories';

export class FixtureService {
  constructor(private readonly fixtures: FixtureRepository, private readonly teams: TeamRepository) {}

  schedule(input: { homeTeamId: string; awayTeamId: string; pitch: string; kickOff: string }): Fixture {
    if (input.homeTeamId === input.awayTeamId) throw new ValidationError('a team cannot play itself');
    const home = this.teams.findById(input.homeTeamId);
    const away = this.teams.findById(input.awayTeamId);
    if (!home || !away) throw new NotFoundError('unknown team');
    if (Number.isNaN(Date.parse(input.kickOff))) throw new ValidationError('kickOff must be an ISO date-time');
    const fixture: Fixture = { id: randomUUID(), ...input, kickOff: new Date(input.kickOff).toISOString() };
    this.checkSchedulingRules(fixture);
    return this.fixtures.save(fixture);
  }

  /** A team plays at most once a day; a pitch hosts one fixture at a time. */
  checkSchedulingRules(fixture: Fixture): void {
    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      if (this.fixtures.findByTeam(teamId).some((f) => f.id !== fixture.id && sameDay(f.kickOff, fixture.kickOff))) {
        throw new ValidationError('a team never plays two fixtures on the same day');
      }
    }
    if (this.fixtures.findByPitch(fixture.pitch).some((f) => f.id !== fixture.id && overlaps(f, fixture))) {
      throw new ValidationError('the pitch is already in use at that time');
    }
  }

  recordResult(fixtureId: string, homeGoals: number, awayGoals: number): Fixture {
    const f = this.get(fixtureId);
    if (f.result) throw new ValidationError('result already recorded');
    if (!(Number.isInteger(homeGoals) && Number.isInteger(awayGoals) && homeGoals >= 0 && awayGoals >= 0)) {
      throw new ValidationError('goals must be non-negative integers');
    }
    return this.fixtures.save({ ...f, result: { homeGoals, awayGoals, recordedAt: new Date().toISOString() } });
  }

  get(id: string): Fixture {
    const f = this.fixtures.findById(id);
    if (!f) throw new NotFoundError(`fixture ${id} not found`);
    return f;
  }

  list(): Fixture[] {
    return this.fixtures.findAll().sort((a, b) => a.kickOff.localeCompare(b.kickOff));
  }
}
