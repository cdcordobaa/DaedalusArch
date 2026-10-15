import { DataSource } from 'typeorm';
import { InvoiceRecord } from './invoice.entity';

export function createAccountingDataSource(url: string | undefined): DataSource {
  return new DataSource({ type: 'postgres', url, entities: [InvoiceRecord], synchronize: false });
}
