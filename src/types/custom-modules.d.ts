declare module '@testing-library/react-native';

declare module 'react-native-image-picker' {
	export interface CameraOptions {
		mediaType?: 'photo' | 'video' | 'mixed';
		maxWidth?: number;
		maxHeight?: number;
		quality?: number;
		saveToPhotos?: boolean;
		includeBase64?: boolean;
	}

	export interface Asset {
		uri?: string;
		fileName?: string;
		width?: number;
		height?: number;
		fileSize?: number;
		type?: string;
	}

	export interface ImagePickerResponse {
		assets?: Asset[];
		didCancel?: boolean;
		errorCode?: string | null;
		errorMessage?: string | null;
	}

	export function launchCamera(options?: CameraOptions): Promise<ImagePickerResponse>;
	export function launchImageLibrary(options?: CameraOptions): Promise<ImagePickerResponse>;
}

declare module '@react-native-image-picker/core';
declare module 'react-native-image-picker/src';

// Analytics SDK type declarations (packages not installed as native modules)
declare module '@react-native-firebase/analytics' {
  interface FirebaseAnalyticsTypes {
    logEvent(name: string, params?: Record<string, unknown>): Promise<void>;
    logScreenView(params: { screen_name: string; screen_class: string }): Promise<void>;
    setUserId(id: string | null): Promise<void>;
    resetAnalyticsData(): Promise<void>;
  }
  function analytics(): FirebaseAnalyticsTypes;
  export default analytics;
}

declare module 'mixpanel-react-native' {
  class Mixpanel {
    constructor(token: string, trackAutomaticEvents?: boolean);
    init(): Promise<void>;
    track(event: string, properties?: Record<string, unknown>): void;
    identify(distinctId: string): void;
    reset(): void;
  }
  export { Mixpanel };
}

declare module '@sentry/react-native' {
  type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  export function captureException(error: Error): void;
  export function captureMessage(message: string, level?: SeverityLevel): void;
  export function setUser(user: { id: string } | null): void;
  export function init(options: { dsn: string; [key: string]: unknown }): void;
}
