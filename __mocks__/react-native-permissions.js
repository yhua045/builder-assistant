/**
 * Manual Jest mock for react-native-permissions.
 * Default behaviour: permission is always GRANTED.
 * Override per-test with jest.spyOn or reassigning the mock functions.
 */

const RESULTS = {
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  DENIED: 'denied',
  GRANTED: 'granted',
  LIMITED: 'limited',
};

const PERMISSIONS = {
  IOS: {
    MICROPHONE: 'ios.permission.MICROPHONE',
    CAMERA: 'ios.permission.CAMERA',
    LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
  },
  ANDROID: {
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    CAMERA: 'android.permission.CAMERA',
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  },
};

const check = jest.fn().mockResolvedValue(RESULTS.GRANTED);
const request = jest.fn().mockResolvedValue(RESULTS.GRANTED);
const openSettings = jest.fn().mockResolvedValue(undefined);

module.exports = {
  RESULTS,
  PERMISSIONS,
  check,
  request,
  openSettings,
};
