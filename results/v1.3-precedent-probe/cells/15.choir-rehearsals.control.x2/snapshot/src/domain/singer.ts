export type Section = 'soprano' | 'alto' | 'tenor' | 'bass';

export interface Singer {
  readonly id: string;
  readonly name: string;
  readonly section: Section;
  readonly phone: string;
  readonly isSectionLeader?: boolean;
}
