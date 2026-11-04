export const newId = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
