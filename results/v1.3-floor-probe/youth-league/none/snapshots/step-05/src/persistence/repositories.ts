import { Fixture, Pitch, Player, Referee, Team } from '../business/entities';

class MemoryRepository<T extends { id: string }> {
  protected readonly items = new Map<string, T>();
  save(item: T): T {
    this.items.set(item.id, item);
    return item;
  }
  findById(id: string): T | undefined {
    return this.items.get(id);
  }
  findAll(): T[] {
    return [...this.items.values()];
  }
}

export class TeamRepository extends MemoryRepository<Team> {}

export class PlayerRepository extends MemoryRepository<Player> {
  findByTeam(teamId: string): Player[] {
    return this.findAll().filter((p) => p.teamId === teamId);
  }
}

export class FixtureRepository extends MemoryRepository<Fixture> {
  findByTeam(teamId: string): Fixture[] {
    return this.findAll().filter((f) => f.homeTeamId === teamId || f.awayTeamId === teamId);
  }
  findByReferee(refereeId: string): Fixture[] {
    return this.findAll().filter((f) => f.refereeId === refereeId);
  }
  findByPitch(pitch: string): Fixture[] {
    return this.findAll().filter((f) => f.pitch === pitch);
  }
}

export class PitchRepository extends MemoryRepository<Pitch> {
  findByName(name: string): Pitch | undefined {
    return this.findAll().find((p) => p.name === name);
  }
}

export class RefereeRepository extends MemoryRepository<Referee> {}
