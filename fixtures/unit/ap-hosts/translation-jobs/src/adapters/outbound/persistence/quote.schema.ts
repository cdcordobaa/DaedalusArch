import { EntitySchema } from 'typeorm';
import { Quote } from '../../../domain/quote';

export const QuoteSchema = new EntitySchema<Quote>({
  name: 'Quote',
  target: Quote,
  tableName: 'quotes',
  columns: {
    id: { type: 'uuid', primary: true },
    clientId: { type: 'uuid', name: 'client_id' },
    pair: { type: 'varchar' },
    words: { type: 'int' },
    matchedWords: { type: 'int', name: 'matched_words' },
    rush: { type: 'boolean' },
    certified: { type: 'boolean' },
    totalCents: { type: 'int', name: 'total_cents' },
    issuedAt: { type: 'timestamptz', name: 'issued_at' },
    accepted: { type: 'boolean' },
  },
});
