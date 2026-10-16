// IO3: randomness in a domain service (random, advisory).
export class IdGenerator {
  next(): string {
    return `${Math.random()}-${crypto.randomUUID()}`;
  }
}
