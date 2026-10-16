export type Section = 'soprano' | 'alto' | 'tenor' | 'bass';

export interface Singer {
  readonly id: string;
  readonly name: string;
  readonly section: Section;
  readonly phone: string;
  /** Set when the singer leads their section. */
  readonly leadsSection?: boolean;
}

export function canMoveRehearsalsOf(singer: Singer, section: Section): boolean {
  return singer.leadsSection === true && singer.section === section;
}
