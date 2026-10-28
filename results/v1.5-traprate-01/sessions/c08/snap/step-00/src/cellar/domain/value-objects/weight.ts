/** Weights are kept as whole grams; brewers speak in kilos. */
export const gramsFromKg = (kg: number): number => Math.round(kg * 1000);

export const kgFromGrams = (grams: number): number => grams / 1000;

export const formatKg = (grams: number): string => `${(grams / 1000).toFixed(2)} kg`;
