/** The school's own list of pass holders, so the desk knows a pupil's name without asking the pass office. */
export interface PupilCards {
  remember(passNo: string, holder: string): void;
  nameOf(passNo: string): string | undefined;
}
