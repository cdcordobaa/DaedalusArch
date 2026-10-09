/**
 * Jest config for the full-mode golden lane L0 (FR-30, U4 Q16 A; BR-U4-CAS-10, CAS-11; Build and Test Step 46).
 * Runs only tests/golden/full-mode-lane.test.ts (Mock judge in replay, zero live calls); needs the lane Neo4j.
 * Usage: npm run test:golden:full
 */
const golden = require('./jest.golden.config.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...golden,
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/tests/golden/full-mode-lane.test.ts'],
  testTimeout: 180000,
};
