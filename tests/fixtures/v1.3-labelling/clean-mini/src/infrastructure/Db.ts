export class Db {
  ready = true;
  written: string[] = [];
  write(id: string): void {
    this.written.push(id);
  }
}
