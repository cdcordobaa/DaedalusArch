// Minimal typings of the typeorm surface this project and the anti-pattern operators use.
export declare function Entity(name?: string): ClassDecorator;
export declare function Column(options?: Record<string, unknown>): PropertyDecorator;
export type FindOptionsWhere<T> = { [P in keyof T]?: T[P] };
export interface FindManyOptions<T> {
  where?: FindOptionsWhere<T>;
  order?: { [P in keyof T]?: 'ASC' | 'DESC' };
  take?: number;
}
export declare class Repository<T> {
  save(entity: T): Promise<T>;
  findOne(options: FindManyOptions<T>): Promise<T | null>;
  find(options?: FindManyOptions<T>): Promise<T[]>;
  count(options?: FindManyOptions<T>): Promise<number>;
}
export type EntityTarget<T> = abstract new (...args: never[]) => T;
export declare function getRepository<T>(target: EntityTarget<T>): Repository<T>;
export interface EntitySchemaColumnOptions {
  type: 'uuid' | 'varchar' | 'int' | 'numeric' | 'timestamptz' | 'date' | 'simple-array' | 'boolean';
  primary?: boolean;
  nullable?: boolean;
  name?: string;
}
export interface EntitySchemaOptions<T> {
  name: string;
  target: EntityTarget<T>;
  tableName: string;
  columns: { [P in keyof T]?: EntitySchemaColumnOptions };
}
export declare class EntitySchema<T> {
  constructor(options: EntitySchemaOptions<T>);
}
export interface DataSourceOptions {
  type: 'postgres';
  url?: string;
  entities: EntitySchema<never>[] | unknown[];
  synchronize?: boolean;
}
export declare class DataSource {
  constructor(options: DataSourceOptions);
  initialize(): Promise<DataSource>;
}
export declare function useContainer(container: unknown): void;
