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
    '^@stitchcraft/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@stitchcraft/color$': '<rootDir>/../../packages/color/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/api',
};
