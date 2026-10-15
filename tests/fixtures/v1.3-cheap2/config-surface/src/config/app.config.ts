/** NEAR-MISS N1: the configuration module reads the environment. */
export const appConfig = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  region: process.env['AWS_REGION'] ?? 'eu-west-1',
};
