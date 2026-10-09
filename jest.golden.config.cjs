/**
 * Jest config for the C16 golden regression suite (FR-30, D-U0-14).
 * Runs only tests/golden; needs a local Neo4j (see tests/golden/golden.test.ts).
 * Usage: npm run test:golden
 */
const base = require('./jest.config.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  roots: ['<rootDir>/tests/golden'],
  // The full-mode lane L0 has its own config and CI step (jest.golden-full.config.cjs, Build and Test Step 46).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/golden/full-mode-lane.test.ts'],
  testTimeout: 120000,
};
