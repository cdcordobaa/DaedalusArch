/** What the course desk needs to know about students. */
export interface StudentRegistry {
  isRegistered(studentId: string): boolean;
}
