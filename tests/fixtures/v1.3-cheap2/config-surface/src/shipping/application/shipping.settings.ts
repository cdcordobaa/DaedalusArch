/** NEAR-MISS N5: a *Settings class may read the environment. */
export class ShippingSettings {
  carrier(): string {
    return process.env.CARRIER ?? 'post';
  }
}
