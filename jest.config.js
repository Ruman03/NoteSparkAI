module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  setupFiles: [
    '<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js',
  ],
  transformIgnorePatterns: [
  'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-firebase|react-native-gesture-handler|react-native-vector-icons|react-native-permissions)/)'
  ],
  moduleNameMapper: {
    '^react-native-fs$': '<rootDir>/__mocks__/react-native-fs.js',
  '^react-native-vector-icons/.+$': '<rootDir>/__mocks__/react-native-vector-icons.js',
  '^react-native-linear-gradient$': '<rootDir>/__mocks__/react-native-linear-gradient.js',
  '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
  '^react-native-pell-rich-editor$': '<rootDir>/__mocks__/react-native-pell-rich-editor.js',
  '^react-native-permissions$': '<rootDir>/__mocks__/react-native-permissions.js',
  },
};
