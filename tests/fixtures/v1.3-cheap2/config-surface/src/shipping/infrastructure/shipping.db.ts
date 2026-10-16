/** PLANTED P5 (with order.db.ts, billing.db.ts and app.config.ts): DATABASE_URL is read in 4 components. */
export class ShippingDb {
  url(): string {
    return process.env.DATABASE_URL ?? '';
  }
}
