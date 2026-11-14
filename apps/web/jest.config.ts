export default {
  displayName: 'web',
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  moduleNameMapper: {
    '^@stitchcraft/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@stitchcraft/color$': '<rootDir>/../../packages/color/src/index.ts',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
  },
  coverageDirectory: '../../coverage/apps/web',
};
