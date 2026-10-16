export type PitchSize = 'S' | 'M' | 'L';

export class Pitch {
  constructor(public readonly id: string, public readonly number: number, public readonly size: PitchSize, public readonly power: boolean) {}
}
