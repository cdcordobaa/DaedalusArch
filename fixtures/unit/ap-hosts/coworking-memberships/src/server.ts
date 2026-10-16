import { buildControllers } from './container';
import { createApp } from './http/app';
import { SystemClock } from './infrastructure/system-clock';
import { createAccountingDataSource } from './persistence/accounting-data-source';
import { InvoiceRecord } from './persistence/invoice.entity';
import { createPrismaService } from './prisma/prisma';

/** Opens the membership database (Prisma) and the accounting ledger (TypeORM), then starts HTTP. */
async function main(): Promise<void> {
  const accounting = await createAccountingDataSource(process.env['ACCOUNTING_DATABASE_URL']).initialize();
  const controllers = buildControllers(createPrismaService(), accounting.getRepository(InvoiceRecord), new SystemClock());
  createApp(controllers).listen(Number(process.env['PORT'] ?? 8080));
}

void main();
