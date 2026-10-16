export class BillingDb {
  url(): string {
    return process.env.DATABASE_URL ?? '';
  }

  cache(): string {
    return process.env.REDIS_URL ?? '';
  }
}
