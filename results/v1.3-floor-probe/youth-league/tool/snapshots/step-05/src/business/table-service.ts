import { AgeGroup } from './entities';
import { FixtureRepository, TeamRepository } from '../persistence/repositories';

export interface TableRow {
  teamId: string;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export class TableService {
  private cache: { key: string; tables: Record<string, TableRow[]> } | undefined;

  constructor(private readonly fixtures: FixtureRepository, private readonly teams: TeamRepository) {}

  /** League tables per age group; cached until a result changes. */
  tables(): Record<string, TableRow[]> {
    const played = this.fixtures.findAll().filter((f) => f.result);
    const key = played.map((f) => `${f.id}:${f.result?.recordedAt}`).join('|') + `#${this.teams.findAll().length}`;
    if (this.cache?.key === key) return this.cache.tables;

    const rows = new Map<string, TableRow>();
    const groupOf = new Map<string, AgeGroup>();
    for (const t of this.teams.findAll()) {
      groupOf.set(t.id, t.ageGroup);
      rows.set(t.id, { teamId: t.id, team: t.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 });
    }
    for (const f of played) {
      const r = f.result;
      const home = rows.get(f.homeTeamId);
      const away = rows.get(f.awayTeamId);
      if (!r || !home || !away) continue;
      home.played++;
      away.played++;
      home.goalsFor += r.homeGoals;
      home.goalsAgainst += r.awayGoals;
      away.goalsFor += r.awayGoals;
      away.goalsAgainst += r.homeGoals;
      if (r.homeGoals > r.awayGoals) {
        home.won++;
        away.lost++;
        home.points += 3;
      } else if (r.homeGoals < r.awayGoals) {
        away.won++;
        home.lost++;
        away.points += 3;
      } else {
        home.drawn++;
        away.drawn++;
        home.points++;
        away.points++;
      }
    }
    const tables: Record<string, TableRow[]> = {};
    for (const row of rows.values()) {
      row.goalDifference = row.goalsFor - row.goalsAgainst;
      const g = groupOf.get(row.teamId) as string;
      (tables[g] ??= []).push(row);
    }
    for (const g of Object.keys(tables)) {
      tables[g].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team));
    }
    this.cache = { key, tables };
    return tables;
  }
}
