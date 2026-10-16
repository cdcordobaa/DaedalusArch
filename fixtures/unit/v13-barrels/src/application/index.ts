// export * of a barrel (multi-hop through export *), plus a local declaration
export * from './ports/persistence';
export { PlaceOrder } from './PlaceOrder';
export const APPLICATION_VERSION = 1;
