// Minimal mock for react-native-fs used in tests
module.exports = {
  exists: jest.fn(async () => true),
  stat: jest.fn(async () => ({ size: 1024 })),
  readFile: jest.fn(async () => 'BASE64_DATA'),
};
