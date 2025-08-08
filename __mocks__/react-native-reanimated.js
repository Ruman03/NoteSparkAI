/* Minimal mock for react-native-reanimated to satisfy imports in tests */
const Reanimated = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'default') return Reanimated;
    // Return identity functions or simple mocks
    const noop = () => {};
    const identity = (v) => v;
    switch (prop) {
      case 'View':
      case 'Text':
      case 'Image':
      case 'ScrollView':
        return 'div';
      case 'createAnimatedComponent':
        return (Component) => Component;
      case 'useSharedValue':
        return (v) => ({ value: v });
      case 'useAnimatedStyle':
        return (fn) => fn();
      case 'useAnimatedProps':
        return (fn) => fn();
      case 'withSpring':
      case 'withTiming':
      case 'withSequence':
      case 'withRepeat':
        return identity;
      case 'Easing':
        return { in: identity, out: identity, inOut: identity, cubic: identity };
      case 'runOnJS':
        return (fn) => fn;
      case 'FadeIn':
      case 'FadeOut':
      case 'SlideInUp':
      case 'SlideOutDown':
        return {};
      default:
        return noop;
    }
  }
});
module.exports = Reanimated;
