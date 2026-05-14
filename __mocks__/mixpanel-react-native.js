/**
 * Manual Jest mock for mixpanel-react-native.
 * The Mixpanel constructor mock returns a stable instance so tests can spy on calls.
 */
const mockMixpanelInstance = {
  init: jest.fn().mockResolvedValue(undefined),
  track: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
};

const Mixpanel = jest.fn().mockImplementation(() => mockMixpanelInstance);

module.exports = { Mixpanel };
