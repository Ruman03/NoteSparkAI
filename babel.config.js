module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
  // Reanimated v4 does not require the separate worklets plugin
  'react-native-reanimated/plugin',
  ],
};
