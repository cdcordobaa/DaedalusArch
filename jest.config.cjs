module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.steps.ts', '**/*.test.ts'],
  moduleNameMapper: {
    // Allow TypeScript files compiled with nodenext (which use .js imports) to work under Jest
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
        },
      },
    ],
  },
};
