/**
 * U5b Step 3 smoke test (BR-U5b-73; D-U5b-6): proves that `tests/unit/scripts/u5b/**` runs under the
 * jest config that already holds the scripts tests (DV-U5b-2) and is type-checked by `tsconfig.scripts.json`.
 */
describe('U5b scripts project (smoke)', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
