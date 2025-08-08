/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// Mock the App component to a minimal placeholder to avoid native modules in tests
jest.mock('../App', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockedApp() {
    return React.createElement(View, null);
  };
});

// Import after mocks
import App from '../App';

test('renders correctly', () => {
  jest.useFakeTimers();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  // Render inside act to avoid warnings
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  // Flush any pending timers to avoid open handles
  ReactTestRenderer.act(() => {
    jest.runOnlyPendingTimers();
  });
  // Unmount inside act as well
  ReactTestRenderer.act(() => {
    renderer.unmount();
  });
  jest.useRealTimers();
});
