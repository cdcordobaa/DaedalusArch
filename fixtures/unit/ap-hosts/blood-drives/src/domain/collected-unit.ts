import { DomainError } from './domain-error';

/** A standard whole-blood unit is 450 ml ± 10 %; anything outside is discarded by the lab. */
export const MIN_UNIT_ML = 405;
export const MAX_UNIT_ML = 495;

export class UnitVolumeError extends DomainError {
  constructor(volumeMl: number) {
    super('UNIT_VOLUME', `A unit of ${String(volumeMl)} ml is outside ${String(MIN_UNIT_ML)}-${String(MAX_UNIT_ML)} ml`);
  }
}

export class CollectedUnit {
  readonly volumeMl: number;
  readonly bagNumber: string;

  constructor(volumeMl: number, bagNumber: string) {
    this.volumeMl = volumeMl;
    this.bagNumber = bagNumber;
  }

  isUsableForPlatelets(): boolean {
    return this.volumeMl >= 450;
  }
}
