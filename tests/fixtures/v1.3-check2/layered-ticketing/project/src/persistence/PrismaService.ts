import { PrismaClient } from '@prisma/client';

export class PrismaService extends PrismaClient {
  async ready(): Promise<this> {
    await this.$connect();
    return this;
  }
}
