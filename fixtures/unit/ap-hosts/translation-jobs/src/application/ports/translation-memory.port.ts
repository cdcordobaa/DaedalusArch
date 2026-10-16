import { Token } from 'typedi';

/** The agency's translation memory: how much of a new text is already translated. */
export interface TranslationMemoryPort {
  matchedWords(pair: string, documentUrl: string): Promise<number>;
}

export const TRANSLATION_MEMORY = new Token<TranslationMemoryPort>('translation-memory');
