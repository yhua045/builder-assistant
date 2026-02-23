import { GetLocationOptions, GeoLocation } from '../../application/services/IGpsService';
import { DeviceLocationProvider } from '../../application/usecases/location/GetBestLocationUseCase';
import { PermissionsAndroid, Platform } from 'react-native';

// Device adapter using react-native-geolocation-service if available.
// Uses dynamic require to avoid hard dependency at compile-time in environments
// where the native module is not present (tests).
export class DeviceGpsService implements DeviceLocationProvider {
  private async ensureAndroidPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app needs access to your location to provide GPS-based features.',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  async getCurrentLocation(options?: GetLocationOptions): Promise<GeoLocation | null> {
    const ok = await this.ensureAndroidPermission();
    if (!ok) throw new Error('permission_denied');

    let Geolocation: any;
    try {
      Geolocation = require('react-native-geolocation-service');
    } catch (e) {
      // Module not installed; surface informative error
      throw new Error('geolocation_module_missing');
    }

    return new Promise<GeoLocation | null>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos: any) => {
          const coords = pos.coords || {};
          const loc: GeoLocation = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracyMeters: coords.accuracy,
            altitude: coords.altitude ?? null,
            timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
          };
          resolve(loc);
        },
        (err: any) => {
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: options?.timeoutMs ?? 10000,
          maximumAge: options?.maxAgeMs ?? 0,
        }
      );
    });
  }
}

export default DeviceGpsService;
