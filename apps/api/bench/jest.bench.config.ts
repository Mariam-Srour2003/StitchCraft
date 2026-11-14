import base from '../jest.config';

/** Runs only the benchmark (`*.bench.ts`), never the unit tests, and vice versa. */
export default {
  ...base,
  displayName: 'api-bench',
  rootDir: '..',
  testMatch: ['<rootDir>/bench/**/*.bench.ts'],
};
