export interface SubmitReadingCommand {
  readonly meterId: string;
  readonly kwh: number;
  readonly takenAt: string;
}

export interface SubmitReadingPort {
  execute(command: SubmitReadingCommand): Promise<void>;
}
