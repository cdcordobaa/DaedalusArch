import { DomainError } from './domain-error';
import { LanguagePair } from './language';

export class TranslatorNotQualifiedError extends DomainError {
  constructor(translatorId: string, pair: string) {
    super('TRANSLATOR_NOT_QUALIFIED', `Translator ${translatorId} does not work in ${pair}`);
  }
}

/** A freelance translator and the directions they are certified for. */
export class Translator {
  pairs: string[];
  active: boolean;

  constructor(
    readonly id: string,
    readonly fullName: string,
    readonly email: string,
    readonly centsPerWord: number,
    pairs: string[],
    active: boolean,
  ) {
    this.pairs = pairs;
    this.active = active;
  }

  ensureQualifiedFor(pair: LanguagePair): void {
    if (!this.active || !this.pairs.includes(pair.toString())) {
      throw new TranslatorNotQualifiedError(this.id, pair.toString());
    }
  }
}
