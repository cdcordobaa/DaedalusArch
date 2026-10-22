/** Driven port: an application-level unit of work; the adapter maps it to its store. */
export interface UnitOfWork {
  readonly id: string;
}
