export const lazyDrops = async (): Promise<unknown> => {
  const m = await import('../../out/memory/MemoryDrops');
  return m;
};
