declare module "http-errors" {
  export class NotFound extends Error {
    readonly statusCode: number;
    constructor(message?: string);
  }
}
