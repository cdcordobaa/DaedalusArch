declare module 'axios' {
  const axios: { get(url: string): Promise<{ data: unknown }> };
  export default axios;
}
