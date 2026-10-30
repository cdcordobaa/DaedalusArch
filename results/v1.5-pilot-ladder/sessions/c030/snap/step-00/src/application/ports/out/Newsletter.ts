/** The monthly newsletter to all members. */
export interface Newsletter {
  publish(subject: string, text: string): Promise<void>;
}
