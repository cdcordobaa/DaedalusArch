/** Errors the lounge service raises. The message is what the front desk shows. */
export abstract class LoungeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The request itself is malformed (a bad code, a number out of range). */
export class InvalidRequest extends LoungeError {}

/** Something the request names does not exist. */
export class NotFound extends LoungeError {}

/** A well-formed request that the lounge rules turn down. */
export class AccessRefused extends LoungeError {}
