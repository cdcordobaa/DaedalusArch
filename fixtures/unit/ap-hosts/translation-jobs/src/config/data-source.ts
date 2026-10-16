import { DataSource } from 'typeorm';
import { TranslationJobSchema } from '../adapters/outbound/persistence/job.schema';
import { QuoteSchema } from '../adapters/outbound/persistence/quote.schema';
import { ReviewSchema } from '../adapters/outbound/persistence/review.schema';
import { TranslatorSchema } from '../adapters/outbound/persistence/translator.schema';

export function createDataSource(url: string | undefined): DataSource {
  return new DataSource({ type: 'postgres', url, entities: [TranslationJobSchema, QuoteSchema, TranslatorSchema, ReviewSchema], synchronize: false });
}
