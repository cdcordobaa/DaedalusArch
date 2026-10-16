/** PLANTED P4: destructuring process.env in the application layer. */
export function currentRegion(): string {
  const { DEPLOY_REGION } = process.env;
  return DEPLOY_REGION ?? 'local';
}
