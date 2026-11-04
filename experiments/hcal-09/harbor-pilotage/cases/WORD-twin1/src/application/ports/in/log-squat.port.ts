export interface LogSquatCommand {
  readonly jobId: string;
  readonly squatMetres: number;
}

export interface LogSquatPort {
  log(command: LogSquatCommand): Promise<void>;
}
