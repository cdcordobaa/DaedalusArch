/** Immutable: private fields behind public getters only; assignments in the constructor only. */
export class Email {
  private local: string;
  readonly #domain: string;

  constructor(address: string) {
    const [local, domain] = address.split('@');
    this.local = local ?? '';
    this.#domain = domain ?? '';
  }

  get user(): string {
    return this.local;
  }

  get domain(): string {
    return this.#domain;
  }

  withDomain(domain: string): Email {
    const copy = new Email(`${this.local}@${domain}`);
    return copy;
  }
}
