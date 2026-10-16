import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { Deadline } from '../../domain/deadline';
import { isLanguageCode, LanguagePair, UnsupportedLanguageError } from '../../domain/language';
import { JobTooLargeError, MAX_WORDS_PER_JOB, MIN_WORDS, WordRate } from '../../domain/pricing';
import { Quote } from '../../domain/quote';
import { RequestQuoteCommand } from '../commands';
import { ValidationError } from '../errors';
import { CLOCK, ClockPort } from '../ports/clock.port';
import { IDS, IdGeneratorPort } from '../ports/id-generator.port';
import { TRANSLATION_MEMORY, TranslationMemoryPort } from '../ports/translation-memory.port';
import { QuoteView, toQuoteView } from '../views';

/** Standard agency rate; specialist rates are negotiated per translator and do not change the client price. */
const STANDARD_RATE = new WordRate(12);

@Service()
export class RequestQuoteUseCase {
  constructor(
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @Inject(TRANSLATION_MEMORY) private readonly memory: TranslationMemoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(IDS) private readonly ids: IdGeneratorPort,
  ) {}

  async execute(command: RequestQuoteCommand): Promise<QuoteView> {
    if (!isLanguageCode(command.sourceLanguage)) {
      throw new UnsupportedLanguageError(command.sourceLanguage);
    }
    if (!isLanguageCode(command.targetLanguage)) {
      throw new UnsupportedLanguageError(command.targetLanguage);
    }
    if (command.sourceLanguage === command.targetLanguage) {
      throw new ValidationError('Source and target language must differ');
    }
    if (command.words < MIN_WORDS) {
      throw new ValidationError('The document has no words to translate');
    }
    if (command.words > MAX_WORDS_PER_JOB) {
      throw new JobTooLargeError(command.words);
    }
    const now = this.clock.now();
    const deadline = new Deadline(new Date(command.dueAt));
    if (!deadline.isFeasible(command.words, now)) {
      throw new ValidationError(`${String(command.words)} words cannot be translated by ${command.dueAt}`);
    }
    const pair = new LanguagePair(command.sourceLanguage, command.targetLanguage);
    const matched = await this.memory.matchedWords(pair.toString(), command.documentUrl);
    const rush = deadline.isRush(now);
    const total = Quote.price(STANDARD_RATE, command.words, matched, rush, command.certified);
    const quote = new Quote(this.ids.next(), command.clientId, pair.toString(), command.words, matched, rush, command.certified, total, now, false);
    return toQuoteView(await this.quotes.save(quote));
  }
}
