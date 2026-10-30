import type { Costume } from '../../../domain/model/Costume';

export interface Wardrobe {
  costume(costumeId: string): Promise<Costume | null>;
}
