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

	const useMockVoice = __DEV__;
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

export default container;

