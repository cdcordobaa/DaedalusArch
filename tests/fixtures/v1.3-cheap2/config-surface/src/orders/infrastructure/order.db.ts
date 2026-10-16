/** NEAR-MISS N2: infrastructure reads its connection string. */
export class OrderDb {
  url(): string {
    return process.env.DATABASE_URL ?? '';
  }
}
