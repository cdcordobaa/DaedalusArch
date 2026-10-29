import type { Noticeboard } from '../../../application/ports/out/Noticeboard';

export class InMemoryNoticeboard implements Noticeboard {
  private readonly posted: string[] = [];

  async post(line: string): Promise<void> {
    this.posted.push(line);
  }

  lines(): string[] {
    return [...this.posted];
  }
}
