/** A pitch on the site and whether guests can book it. */
export interface PitchInfo {
  readonly pitch: string;
  readonly state: 'open' | 'closed_for_works';
}

export interface Pitches {
  find(pitch: string): Promise<PitchInfo | null>;
}
