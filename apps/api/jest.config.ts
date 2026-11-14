export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: '.',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@hobbygrid/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@hobbygrid/color$': '<rootDir>/../../packages/color/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/api',
};
