import { randomUUID } from 'node:crypto';
import { Fixture, NotFoundError, ValidationError } from './entities';
import { overlaps, sameDay } from './rules';
import { FixtureRepository, PitchRepository, TeamRepository } from '../persistence/repositories';
import { RefereeService } from './referee-service';

export class FixtureService {
  constructor(
    private readonly fixtures: FixtureRepository,
    private readonly teams: TeamRepository,
    private readonly pitches: PitchRepository,
    private readonly referees: RefereeService,
  ) {}

  registerPitch(name: string, postcode: string) {
    if (!name || !postcode) throw new ValidationError('name and postcode are required');
    if (this.pitches.findByName(name)) throw new ValidationError('pitch already exists');
    return this.pitches.save({ id: randomUUID(), name, postcode });
  }

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

  /** League admin correction of a recorded result. */
  correctResult(fixtureId: string, homeGoals: number, awayGoals: number): Fixture {
    const f = this.get(fixtureId);
    if (!f.result) throw new ValidationError('no result recorded yet');
    if (!(Number.isInteger(homeGoals) && Number.isInteger(awayGoals) && homeGoals >= 0 && awayGoals >= 0)) {
      throw new ValidationError('goals must be non-negative integers');
    }
    return this.fixtures.save({ ...f, result: { homeGoals, awayGoals, recordedAt: new Date().toISOString() } });
  }

  postpone(fixtureId: string, newKickOff: string): Fixture {
    const f = this.get(fixtureId);
    if (!f.atRisk) throw new ValidationError('only an at-risk fixture can be postponed');
    if (f.result) throw new ValidationError('fixture already played');
    if (Number.isNaN(Date.parse(newKickOff))) throw new ValidationError('kickOff must be an ISO date-time');
    let moved: Fixture = { ...f, kickOff: new Date(newKickOff).toISOString(), atRisk: false, postponedFrom: f.kickOff };
    this.checkSchedulingRules(moved);
    if (moved.refereeId && !this.referees.stillFree(moved)) moved = { ...moved, refereeId: undefined };
    return this.fixtures.save(moved);
  }

  get(id: string): Fixture {
    const f = this.fixtures.findById(id);
    if (!f) throw new NotFoundError(`fixture ${id} not found`);
    return f;
  }

  list(): (Fixture & { needsReferee: boolean })[] {
    return this.fixtures
      .findAll()
      .sort((a, b) => a.kickOff.localeCompare(b.kickOff))
      .map((f) => ({ ...f, needsReferee: !f.refereeId }));
  }
}
