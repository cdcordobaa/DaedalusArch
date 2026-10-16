import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { Translator } from '../../domain/translator';
import { ValidationError } from '../errors';
import { IDS, IdGeneratorPort } from '../ports/id-generator.port';
import { toTranslatorView, TranslatorView } from '../views';

@Service()
export class RegisterTranslatorUseCase {
  constructor(
    @InjectRepository(Translator) private readonly translators: Repository<Translator>,
    @Inject(IDS) private readonly ids: IdGeneratorPort,
  ) {}

  async execute(fullName: string, email: string, pairs: string[], centsPerWord: number): Promise<TranslatorView> {
    if (email.indexOf('@') < 1) {
      throw new ValidationError(`Invalid email ${email}`);
    }
    if (pairs.length === 0) {
      throw new ValidationError('A translator works in at least one language pair');
    }
    if (centsPerWord < 3 || centsPerWord > 60) {
      throw new ValidationError('Freelance rates are 3 to 60 cents per word');
    }
    if ((await this.translators.count({ where: { email } })) > 0) {
      throw new ValidationError(`${email} is already registered`);
    }
    const translator = new Translator(this.ids.next(), fullName.trim(), email, centsPerWord, pairs, true);
    return toTranslatorView(await this.translators.save(translator));
  }
}
