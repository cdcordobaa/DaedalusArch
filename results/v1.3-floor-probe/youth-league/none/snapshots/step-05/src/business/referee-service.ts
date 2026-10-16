import { randomUUID } from 'node:crypto';
import { AgeGroup, Fixture, NotFoundError, Referee, ValidationError } from './entities';
import { FixtureRepository, PlayerRepository, RefereeRepository, TeamRepository } from '../persistence/repositories';

export const MIN_GAP_MINUTES = 120;

export class RefereeService {
  constructor(
    private readonly referees: RefereeRepository,
    private readonly fixtures: FixtureRepository,
    private readonly teams: TeamRepository,
    private readonly players: PlayerRepository,
  ) {}

  register(input: { name: string; email: string; ageGroups: string[] }): Referee {
    if (!input.email) throw new ValidationError('email is required');
    const groups = (input.ageGroups ?? []).filter((g) => /^U\d{1,2}$/.test(g)) as AgeGroup[];
    return this.referees.save({ id: randomUUID(), name: input.name, email: input.email.toLowerCase(), ageGroups: groups });
  }

  list(): Referee[] {
    return this.referees.findAll();
  }

  assign(fixtureId: string, refereeId: string): Fixture {
    const f = this.fixtures.findById(fixtureId);
    if (!f) throw new NotFoundError('fixture not found');
    const ref = this.referees.findById(refereeId);
    if (!ref) throw new NotFoundError('referee not found');
    const problem = this.whyCannotOfficiate(ref, f);
    if (problem) throw new ValidationError(problem);
    return this.fixtures.save({ ...f, refereeId });
  }

  /** Returns a reason when the referee may not officiate the fixture (at its current kick-off), else undefined. */
  whyCannotOfficiate(ref: Referee, f: Fixture): string | undefined {
    const home = this.teams.findById(f.homeTeamId);
    const away = this.teams.findById(f.awayTeamId);
    if (!home || !away) return 'unknown team';
    if (!ref.ageGroups.includes(home.ageGroup)) return `referee may not officiate ${home.ageGroup}`;
    for (const team of [home, away]) {
      if (this.players.findByTeam(team.id).some((p) => p.parentEmail.toLowerCase() === ref.email)) {
        return `referee is a parent in ${team.name}`;
      }
    }
    const kick = new Date(f.kickOff).getTime();
    const clash = this.fixtures
      .findByReferee(ref.id)
      .some((o) => o.id !== f.id && Math.abs(new Date(o.kickOff).getTime() - kick) < MIN_GAP_MINUTES * 60000);
    if (clash) return 'referee has another fixture less than two hours apart';
    return undefined;
  }

  stillFree(f: Fixture): boolean {
    if (!f.refereeId) return false;
    const ref = this.referees.findById(f.refereeId);
    return !!ref && this.whyCannotOfficiate(ref, f) === undefined;
  }
}
