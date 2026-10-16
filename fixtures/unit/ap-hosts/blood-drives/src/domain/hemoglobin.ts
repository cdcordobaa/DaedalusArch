import { DomainError } from './domain-error';

/** Screening thresholds in g/dL (finger-prick test before the donation). */
export const HEMOGLOBIN_MIN: Readonly<Record<string, number>> = { female: 12.5, male: 13.5, other: 12.5 };

export class HemoglobinTooLowError extends DomainError {
  constructor(value: number, minimum: number) {
    super('HEMOGLOBIN_TOO_LOW', `Hemoglobin ${String(value)} g/dL is below ${String(minimum)} g/dL`);
  }
}

export class HemoglobinReading {
  readonly gramsPerDecilitre: number;

  constructor(gramsPerDecilitre: number) {
    this.gramsPerDecilitre = gramsPerDecilitre;
  }

  ensureSufficientFor(sex: string): void {
    const minimum = HEMOGLOBIN_MIN[sex] ?? HEMOGLOBIN_MIN['other'] ?? 12.5;
    if (this.gramsPerDecilitre < minimum) {
      throw new HemoglobinTooLowError(this.gramsPerDecilitre, minimum);
    }
  }
}
