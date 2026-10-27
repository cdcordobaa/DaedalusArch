declare module "@nestjs/common" {
  export class Logger {
    constructor(context?: string);
    warn(message: string): void;
  }
}
