/**
 * Manual Jest mock for @sentry/react-native.
 */
module.exports = {
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  init: jest.fn(),
};
