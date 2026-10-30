export interface BookFreightParamsDto {
  dispatchId: string;
  collectionDate: string;
}

export interface DispatchResponseDto {
  dispatchId: string;
  status: string;
  error?: string;
}

export interface HttpReply<T> {
  status: number;
  body: T;
}
