import { EntitySchema } from 'typeorm';
import { TranslationJob } from '../../../domain/translation-job';

/** Mapping of the domain class; the domain stays free of ORM decorators. */
export const TranslationJobSchema = new EntitySchema<TranslationJob>({
  name: 'TranslationJob',
  target: TranslationJob,
  tableName: 'translation_jobs',
  columns: {
    id: { type: 'uuid', primary: true },
    quoteId: { type: 'uuid', name: 'quote_id' },
    clientId: { type: 'uuid', name: 'client_id' },
    pair: { type: 'varchar' },
    words: { type: 'int' },
    dueAt: { type: 'timestamptz', name: 'due_at' },
    status: { type: 'varchar' },
    translatorId: { type: 'uuid', name: 'translator_id', nullable: true },
    deliveredFileUrl: { type: 'varchar', name: 'delivered_file_url', nullable: true },
  },
});
