import { SchoolError } from '../SchoolError';
import { parseInstrument, type Instrument } from './Instrument';

/** A teacher, the instruments they teach, and the id of their calendar (where their teaching hours are kept). */
export class Teacher {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly instruments: readonly Instrument[],
    readonly calendarId: string,
  ) {}

  static hire(id: string, name: string, instruments: readonly string[], calendarId: string): Teacher {
    if (name.trim() === '') throw new SchoolError('a teacher needs a name');
    if (instruments.length === 0) throw new SchoolError('a teacher needs at least one instrument');
    const parsed = instruments.map(parseInstrument);
    if (calendarId.trim() === '') throw new SchoolError('a teacher needs a calendar id');
    return new Teacher(id, name.trim(), [...new Set(parsed)], calendarId.trim());
  }

  teaches(instrument: Instrument): boolean {
    return this.instruments.includes(instrument);
  }
}
