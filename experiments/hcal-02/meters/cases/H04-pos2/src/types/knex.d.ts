declare module "knex" {
  export interface Transaction {
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }
}
