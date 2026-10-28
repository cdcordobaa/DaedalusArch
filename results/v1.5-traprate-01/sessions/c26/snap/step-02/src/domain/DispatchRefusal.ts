/** A request the dispatch rules turn down. The message is shown to the dispatcher as it is. */
export class DispatchRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DispatchRefusal';
  }
}
