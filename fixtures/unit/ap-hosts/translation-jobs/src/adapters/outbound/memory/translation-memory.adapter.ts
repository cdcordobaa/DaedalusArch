import { TranslationMemoryPort } from '../../../application/ports/translation-memory.port';

interface TmServerClient {
  analyse(pair: string, documentUrl: string): Promise<{ fuzzy85to100: number; exact: number }>;
}

/** Translation-memory server adapter: counts exact and high-fuzzy matches as already translated. */
export class TranslationMemoryAdapter implements TranslationMemoryPort {
  constructor(private readonly tm: TmServerClient) {}

  async matchedWords(pair: string, documentUrl: string): Promise<number> {
    const analysis = await this.tm.analyse(pair, documentUrl);
    return analysis.exact + analysis.fuzzy85to100;
  }
}
