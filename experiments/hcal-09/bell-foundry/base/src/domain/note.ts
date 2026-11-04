export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const noteLabel = (note: NoteName, octave: number): string => `${note}${octave}`;
