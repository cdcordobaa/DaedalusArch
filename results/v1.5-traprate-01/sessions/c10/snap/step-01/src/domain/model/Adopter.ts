import { ShelterError } from '../errors/ShelterError';

/** A person who may apply to adopt a pet. */
export class Adopter {
  private constructor(readonly id: string, readonly name: string) {}

  static register(id: string, name: string): Adopter {
    const trimmed = name.trim();
    if (trimmed === '') throw new ShelterError('an adopter needs a name');
    return new Adopter(id, trimmed);
  }
}
