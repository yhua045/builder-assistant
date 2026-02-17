declare module 'react-native-image-picker';
declare module '@testing-library/react-native';
declare module '@testing-library/jest-native';
declare module 'react-native-safe-area-context';

declare global {
	namespace JSX {
		interface IntrinsicElements {
			'mock-snap-receipt': any;
			'mock-invoice-form': any;
			'mock-hero-section': any;
			'mock-cash-outflow': any;
			'mock-active-tasks': any;
			'mock-urgent-alerts': any;
		}
	}
}

export {};
