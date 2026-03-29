/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: [
    '**/*.test.ts',
    '**/*.steps.ts',
  ],
  moduleNameMapper: {
    // Resolve .js extension imports (NodeNext compat under Jest)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Path aliases
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@apg-extractor/(.*)$': '<rootDir>/src/apg-extractor/$1',
    '^@neo4j-ingestion/(.*)$': '<rootDir>/src/neo4j-ingestion/$1',
    '^@spec-parser/(.*)$': '<rootDir>/src/spec-parser/$1',
    '^@fitness-compiler/(.*)$': '<rootDir>/src/fitness-compiler/$1',
    '^@neuro-symbolic-router/(.*)$': '<rootDir>/src/neuro-symbolic-router/$1',
    '^@evaluation-engine/(.*)$': '<rootDir>/src/evaluation-engine/$1',
    '^@llm-critic/(.*)$': '<rootDir>/src/llm-critic/$1',
    '^@scoring-engine/(.*)$': '<rootDir>/src/scoring-engine/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@firewall-context/(.*)$': '<rootDir>/src/firewall-context/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          verbatimModuleSyntax: false,
          esModuleInterop: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/cli/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
