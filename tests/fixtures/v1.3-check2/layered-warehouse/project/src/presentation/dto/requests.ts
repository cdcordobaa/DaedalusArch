export interface ReceiveDto {
  sku: string;
  bin: string;
  quantity: number;
}

export interface PickDto {
  sku: string;
  quantity: number;
}

export interface CountDto {
  bin: string;
  counted: number;
  expected: number;
}
