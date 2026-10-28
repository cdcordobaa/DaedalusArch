import { SchoolError } from '../SchoolError';

export const INSTRUMENTS = ['piano', 'violin', 'cello', 'guitar', 'flute', 'drums', 'voice'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export function parseInstrument(value: string): Instrument {
  const found = INSTRUMENTS.find((i) => i === value);
  if (found === undefined) throw new SchoolError(`unknown instrument '${value}'`);
  return found;
}
