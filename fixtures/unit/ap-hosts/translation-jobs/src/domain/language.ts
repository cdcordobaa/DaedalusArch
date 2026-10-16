import { DomainError } from './domain-error';

/** ISO 639-1 codes the agency has certified translators for. */
export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'zh'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export function isLanguageCode(value: string): value is LanguageCode {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export class UnsupportedLanguageError extends DomainError {
  constructor(code: string) {
    super('UNSUPPORTED_LANGUAGE', `No certified translators for "${code}"`);
  }
}

/** Direction matters: an en→de specialist does not necessarily translate de→en. */
export class LanguagePair {
  readonly source: string;
  readonly target: string;

  constructor(source: string, target: string) {
    this.source = source;
    this.target = target;
  }

  static parse(text: string): LanguagePair {
    const [source = '', target = ''] = text.split('>');
    return new LanguagePair(source, target);
  }

  toString(): string {
    return `${this.source}>${this.target}`;
  }

  equals(other: LanguagePair): boolean {
    return this.source === other.source && this.target === other.target;
  }
}
