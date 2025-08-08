/**
 * @format
 */

import { AppRegistry } from 'react-native';
// Optional: Sentry init (no-op if not installed or DSN missing)
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const Sentry = require('@sentry/react-native');
	const { default: Config } = require('react-native-config');
	if (Config?.SENTRY_DSN) {
		Sentry.init({
			dsn: Config.SENTRY_DSN,
			tracesSampleRate: 0.2,
			enableAutoPerformanceTracing: true,
		});
	}
} catch (e) {
	// Sentry not installed; skip
}
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
