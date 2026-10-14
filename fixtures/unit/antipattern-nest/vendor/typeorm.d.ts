// Minimal typings of the typeorm surface the fixture and the anti-pattern operators use.
export declare function Entity(name?: string): ClassDecorator;
export declare function Column(options?: Record<string, unknown>): PropertyDecorator;
export declare function PrimaryGeneratedColumn(strategy?: string): PropertyDecorator;
export type FindOptionsWhere<T> = { [P in keyof T]?: T[P] };
export interface FindManyOptions<T> {
  where?: FindOptionsWhere<T>;
}
export declare class Repository<T> {
  create(entity: Partial<T>): T;
  save(entity: T): Promise<T>;
  findOne(options: FindManyOptions<T>): Promise<T | null>;
  find(options?: FindManyOptions<T>): Promise<T[]>;
  count(options?: FindManyOptions<T>): Promise<number>;
}
export type EntityTarget<T> = new () => T;
export declare function getRepository<T>(target: EntityTarget<T>): Repository<T>;
export declare class DataSource {
  getRepository<T>(target: EntityTarget<T>): Repository<T>;
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}
