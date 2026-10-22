/** An entity inside the Order aggregate: it has its own id but is only reached and saved through its order. */
export class OrderLine {
  constructor(readonly id: string, readonly sku: string, readonly quantity: number) {}
}
