/** A request the cellar refuses. The message is shown to the brewer as is. */
export class CellarRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CellarRefusal';
  }
}
