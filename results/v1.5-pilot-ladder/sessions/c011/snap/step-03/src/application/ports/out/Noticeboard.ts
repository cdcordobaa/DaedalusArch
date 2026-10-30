/** The noticeboard in the shed. */
export interface Noticeboard {
  post(line: string): Promise<void>;
}
