import { PrismaClient } from '@prisma/client';

/**
 * The process-wide Prisma client. It is opened once by the composition root and injected into every service, so
 * connection pooling and shutdown live in one place.
 */
export type PrismaService = PrismaClient;

export function createPrismaService(): PrismaService {
  return new PrismaClient({ log: ['warn', 'error'] });
}
