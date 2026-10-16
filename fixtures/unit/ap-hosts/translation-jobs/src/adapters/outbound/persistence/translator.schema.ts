import { EntitySchema } from 'typeorm';
import { Translator } from '../../../domain/translator';

export const TranslatorSchema = new EntitySchema<Translator>({
  name: 'Translator',
  target: Translator,
  tableName: 'translators',
  columns: {
    id: { type: 'uuid', primary: true },
    fullName: { type: 'varchar', name: 'full_name' },
    email: { type: 'varchar' },
    centsPerWord: { type: 'int', name: 'cents_per_word' },
    pairs: { type: 'simple-array' },
    active: { type: 'boolean' },
  },
});
