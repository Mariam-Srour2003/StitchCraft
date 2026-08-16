module.exports = {
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: undefined,
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html', 'text-summary'],
};
