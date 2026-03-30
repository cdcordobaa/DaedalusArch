// VIOLATION: God class with 15 public methods — SRP proxy violation
export class GodTask {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public completed: boolean,
    public categoryId: string,
    public priority: string,
    public tags: string[]
  ) {}

  complete(): void { this.completed = true; }
  uncomplete(): void { this.completed = false; }
  updateTitle(t: string): void { this.title = t; }
  updateDescription(d: string): void { this.description = d; }
  updatePriority(p: string): void { this.priority = p; }
  addTag(tag: string): void { this.tags.push(tag); }
  removeTag(tag: string): void { this.tags = this.tags.filter(t => t !== tag); }
  isValid(): boolean { return this.title.length > 0; }
  isHighPriority(): boolean { return this.priority === 'high'; }
  isCompleted(): boolean { return this.completed; }
  hasCategory(): boolean { return !!this.categoryId; }
  serialize(): string { return JSON.stringify(this); }
  clone(): GodTask { return Object.assign(new GodTask('','','',false,'','',[]), this); }
  equals(other: GodTask): boolean { return this.id === other.id; }
  toString(): string { return `Task(${this.id}): ${this.title}`; }
}
