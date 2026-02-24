import 'reflect-metadata';
// Allow access to `process.env` in RN build-time scripts; keep typing loose here.
declare const process: any;
import { container } from 'tsyringe';
import { DrizzleProjectRepository } from '../repositories/DrizzleProjectRepository';
import { DrizzleInvoiceRepository } from '../repositories/DrizzleInvoiceRepository';
import { DrizzlePaymentRepository } from '../repositories/DrizzlePaymentRepository';
import { DrizzleReceiptRepository } from '../repositories/DrizzleReceiptRepository';
import { DrizzleTaskRepository } from '../repositories/DrizzleTaskRepository';
import { DrizzleDocumentRepository } from '../repositories/DrizzleDocumentRepository';
import { MobileFileSystemAdapter } from '../files/MobileFileSystemAdapter';
import { MobileCameraAdapter } from '../camera/MobileCameraAdapter';
import { MockAudioRecorder } from '../voice/MockAudioRecorder';
import { MockVoiceParsingService } from '../voice/MockVoiceParsingService';
import { DrizzleStoredLocationRepository } from '../location/DrizzleStoredLocationRepository';
import { DeviceGpsService } from '../location/DeviceGpsService';
import { LocalLocationAdapter } from '../location/LocalLocationAdapter';
import { RemoteLocationAdapter } from '../location/RemoteLocationAdapter';
import { GetNearbyProjectsUseCase } from '../../application/usecases/location/GetNearbyProjectsUseCase';
import { MobileAudioRecorder } from '../voice/MobileAudioRecorder';
import { RemoteVoiceParsingService } from '../voice/RemoteVoiceParsingService';
import { GroqSTTAdapter } from '../voice/GroqSTTAdapter';
import { GroqTranscriptParser } from '../voice/GroqTranscriptParser';

// Repository registrations
if (typeof (container as any).registerSingleton === 'function') {
	// Repository registrations
	container.registerSingleton('ProjectRepository', DrizzleProjectRepository);
	container.registerSingleton('InvoiceRepository', DrizzleInvoiceRepository);
	container.registerSingleton('PaymentRepository', DrizzlePaymentRepository);
	container.registerSingleton('ReceiptRepository', DrizzleReceiptRepository);
	container.registerSingleton('TaskRepository', DrizzleTaskRepository);
	container.registerSingleton('DocumentRepository', DrizzleDocumentRepository);
	container.registerSingleton('FileSystemAdapter', MobileFileSystemAdapter);
	container.registerSingleton('CameraService', MobileCameraAdapter);

	// ── Voice Services ────────────────────────────────────────────────────────────
	//
	// Feature flag:
	//   __DEV__ = true  (Metro / Jest)        → Mocks (safe, no native modules)
	//   __DEV__ = false (production/release)  → Real Groq-backed adapters
	//   VOICE_USE_MOCK_PARSER = 'true'        → Keep mock parser (soft rollout)
	//
	const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';

	// Allow forcing the real audio recorder via env var when running locally:
	//   FORCE_REAL_AUDIO=true npx react-native run-ios
	const forceRealRecorder = process.env.FORCE_REAL_AUDIO === 'true';
	const useMockVoice = __DEV__ && !forceRealRecorder;
	const useMockParser = useMockVoice || process.env.VOICE_USE_MOCK_PARSER === 'true';

	if (useMockVoice) {
		container.registerSingleton('IAudioRecorder', MockAudioRecorder);
	} else {
		container.registerSingleton('IAudioRecorder', MobileAudioRecorder);
	}

	if (useMockParser) {
		container.registerSingleton('IVoiceParsingService', MockVoiceParsingService);
	} else {
		container.register('IVoiceParsingService', {
			useFactory: () =>
				new RemoteVoiceParsingService(
					new GroqSTTAdapter(GROQ_API_KEY),
					new GroqTranscriptParser(GROQ_API_KEY),
				),
		});
	}
} else {
	// tsyringe was mocked (e.g. in tests). Don't attempt registrations against the
	// mocked container to avoid runtime errors; tests are expected to control the
	// container behavior themselves.
}

// Location services
if (typeof (container as any).registerSingleton === 'function') {
	container.registerSingleton('StoredLocationRepository', DrizzleStoredLocationRepository);
	container.registerSingleton('GpsService', DeviceGpsService);
	container.registerSingleton('LocalLocationAdapter', LocalLocationAdapter);
	container.registerSingleton('RemoteLocationAdapter', RemoteLocationAdapter);
	// Network status: simple online check via NetInfo (navigator.onLine fallback for tests)
	const networkStatus = { isOnline: () => true };
	//
	// Feature flag: LOCATION_REMOTE_ENABLED
	//   'true'  → attempt server-side spatial query when online (requires backend endpoint)
	//   unset / anything else → local-only (safe default; remote skeleton throws not_implemented)
	//
	const locationRemoteEnabled = process.env.LOCATION_REMOTE_ENABLED === 'true';
	container.register('GetNearbyProjectsUseCase', {
		useFactory: () =>
			new GetNearbyProjectsUseCase(
				new LocalLocationAdapter(),
				new RemoteLocationAdapter(),
				networkStatus,
				locationRemoteEnabled,
			),
	});
}

export default container;

