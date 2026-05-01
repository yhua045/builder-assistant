/**
 * Manual Jest mock for @react-native-firebase/analytics.
 * Provides a stable mock instance so tests can verify calls.
 */
const mockAnalyticsInstance = {
  logEvent: jest.fn().mockResolvedValue(undefined),
  logScreenView: jest.fn().mockResolvedValue(undefined),
  setUserId: jest.fn().mockResolvedValue(undefined),
  resetAnalyticsData: jest.fn().mockResolvedValue(undefined),
};

const analytics = jest.fn(() => mockAnalyticsInstance);

module.exports = analytics;
module.exports.default = analytics;
