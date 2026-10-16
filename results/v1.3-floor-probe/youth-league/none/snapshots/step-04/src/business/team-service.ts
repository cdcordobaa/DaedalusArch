import { randomUUID } from 'node:crypto';
import { AgeGroup, NotFoundError, Player, Team, ValidationError } from './entities';
import { fitsAgeGroup, seasonStartYear } from './rules';
import { PlayerRepository, TeamRepository } from '../persistence/repositories';

export class TeamService {
  constructor(private readonly teams: TeamRepository, private readonly players: PlayerRepository, private readonly clock: () => Date = () => new Date()) {}

  registerTeam(input: { name: string; ageGroup: string; coachName: string; coachEmail: string }): Team {
    if (!/^U\d{1,2}$/.test(input.ageGroup)) throw new ValidationError('ageGroup must look like U9, U11...');
    if (!input.name || !input.coachEmail) throw new ValidationError('name and coachEmail are required');
    return this.teams.save({ id: randomUUID(), name: input.name, ageGroup: input.ageGroup as AgeGroup, coachName: input.coachName, coachEmail: input.coachEmail });
  }

  registerPlayer(input: { name: string; birthDate: string; parentEmail: string; teamId: string }): Player {
    const team = this.getTeam(input.teamId);
    if (!fitsAgeGroup(input.birthDate, team.ageGroup, seasonStartYear(this.clock()))) {
      throw new ValidationError(`player does not fit age group ${team.ageGroup}`);
    }
    return this.players.save({ id: randomUUID(), ...input });
  }

  getTeam(id: string): Team {
    const t = this.teams.findById(id);
    if (!t) throw new NotFoundError(`team ${id} not found`);
    return t;
  }

  listTeams(): Team[] {
    return this.teams.findAll();
  }

  playersOf(teamId: string): Player[] {
    return this.players.findByTeam(teamId);
  }
}
