declare module '@nestjs/common' {
  export class Logger {
    constructor(context?: string);
    log(message: string): void;
  }
}
