export interface ApplyCommand {
  readonly openingId: string;
  readonly name: string;
  readonly email: string;
  readonly yearsExperience: number;
}

export interface ApplyToOpening {
  execute(cmd: ApplyCommand): Promise<{ applicationId: string }>;
}
