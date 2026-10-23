export class BaseRepository<TModel, TEntity> {
  protected rows: TModel[] = [];
  async create(data: Partial<TEntity>): Promise<TEntity> { this.rows.push(data as unknown as TModel); return data as TEntity; }
  async update(query: Partial<TModel>, data: Partial<TModel>): Promise<{ matched: number }> { void query; void data; return { matched: 0 }; }
  async findOne(query: Partial<TModel>): Promise<TEntity | null> { void query; return null; }
}
