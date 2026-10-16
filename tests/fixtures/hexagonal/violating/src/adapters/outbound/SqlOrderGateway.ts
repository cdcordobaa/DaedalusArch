/** Outbound adapter that implements no port (violates the port-adapter pattern). */
export class SqlOrderGateway {
  describe(): string {
    return 'sql';
  }
}
