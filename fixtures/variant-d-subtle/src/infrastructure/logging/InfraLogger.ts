// Concrete logger in infrastructure — should be behind an ILogger interface
export class InfraLogger {
  log(message: string): void {
    console.log(`[LOG] ${new Date().toISOString()} ${message}`);
  }
  error(message: string): void {
    console.error(`[ERR] ${new Date().toISOString()} ${message}`);
  }
}
