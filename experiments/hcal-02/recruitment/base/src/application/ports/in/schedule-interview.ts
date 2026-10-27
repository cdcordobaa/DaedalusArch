export interface ScheduleCommand {
  readonly applicationId: string;
  readonly startsAt: Date;
  readonly interviewer: string;
}

export interface ScheduleInterview {
  execute(cmd: ScheduleCommand): Promise<{ interviewId: string }>;
}
