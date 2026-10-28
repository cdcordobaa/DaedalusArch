export interface HttpResult<T> {
  status: number;
  body: T;
}
