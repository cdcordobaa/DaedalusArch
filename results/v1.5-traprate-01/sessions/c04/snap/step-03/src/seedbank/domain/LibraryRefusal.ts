/** Raised when the library refuses a request; the message is shown to the member as is. */
export class LibraryRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryRefusal';
  }
}
