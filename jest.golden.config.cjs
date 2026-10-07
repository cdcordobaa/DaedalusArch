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
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 120000,
};
