declare module 'class-validator' {
  export function validateSync(target: object): unknown[];
}
