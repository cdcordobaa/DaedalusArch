function Entity(): ClassDecorator { return () => undefined; }

@Entity()
export class Invoice { id!: string; total!: number; }
