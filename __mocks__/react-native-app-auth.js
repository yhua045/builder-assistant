/** Manual mock for react-native-app-auth */
module.exports = {
  authorize: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    accessTokenExpirationDate: new Date(Date.now() + 3600_000).toISOString(),
    idToken: null,
    tokenType: 'Bearer',
    scopes: ['openid', 'email', 'profile'],
  }),
  refresh: jest.fn().mockResolvedValue({
    accessToken: 'mock-refreshed-token',
    refreshToken: 'mock-refresh-token',
    accessTokenExpirationDate: new Date(Date.now() + 3600_000).toISOString(),
    idToken: null,
    tokenType: 'Bearer',
  }),
  revoke: jest.fn().mockResolvedValue(true),
};
