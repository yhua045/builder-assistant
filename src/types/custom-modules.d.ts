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
