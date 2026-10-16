/** Records stored by the persistence layer. The business layer re-exports them. */
export type AgeGroup = `U${number}`;

export interface Team {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  coachName: string;
  coachEmail: string;
}

export interface Player {
  id: string;
  name: string;
  birthDate: string;
  parentEmail: string;
  teamId: string;
}

export interface Result {
  homeGoals: number;
  awayGoals: number;
  recordedAt: string;
}

export interface Fixture {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  pitch: string;
  kickOff: string; // ISO date-time
  result?: Result;
  atRisk?: boolean;
  postponedFrom?: string;
  refereeId?: string;
}

export interface Referee {
  id: string;
  name: string;
  email: string;
  ageGroups: AgeGroup[];
}

export interface Pitch {
  id: string;
  name: string;
  postcode: string;
}
