/** PLANTED P2: element access on process.env in the application layer. */
export class OrderFeatures {
  expressShipping(): boolean {
    return process.env['FEATURE_EXPRESS'] === 'on';
  }
}
