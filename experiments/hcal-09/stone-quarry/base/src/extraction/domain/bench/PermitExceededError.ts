export class PermitExceededError extends Error {
  constructor(benchId: string, month: string) {
    super(`bench ${benchId}: the blasts planned for ${month} would exceed the monthly permit`);
  }
}
