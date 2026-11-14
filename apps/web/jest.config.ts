export default {
  displayName: 'web',
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  moduleNameMapper: {
    '^@hobbygrid/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@hobbygrid/color$': '<rootDir>/../../packages/color/src/index.ts',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
  },
  coverageDirectory: '../../coverage/apps/web',
};
