/** PLANTED P1: the domain reads the environment. */
export class TaxPolicy {
  rate(): number {
    return Number(process.env.TAX_RATE ?? '0.2');
  }
}
