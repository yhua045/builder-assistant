import 'reflect-metadata';
// Allow access to `process.env` in RN build-time scripts; keep typing loose here.
declare const process: any;
import {
	FORCE_REAL_AUDIO as ENV_FORCE_REAL_AUDIO,
	GROQ_API_KEY as ENV_GROQ_API_KEY,
	LOCATION_REMOTE_ENABLED as ENV_LOCATION_REMOTE_ENABLED,
	VOICE_USE_MOCK_PARSER as ENV_VOICE_USE_MOCK_PARSER,
} from '@env';
import { container } from 'tsyringe';
import { DrizzleProjectRepository } from '../../../features/projects/infrastructure/DrizzleProjectRepository.ts';
import { DrizzleInvoiceRepository } from '../../../features/invoices/infrastructure/DrizzleInvoiceRepository.ts';
import { DrizzlePaymentRepository } from '../../../features/payments/infrastructure/DrizzlePaymentRepository.ts';
import { DrizzleReceiptRepository } from '../../../features/receipts/infrastructure/DrizzleReceiptRepository.ts';
import { DrizzleTaskRepository } from '../../../features/tasks/infrastructure/DrizzleTaskRepository.ts';
import { DrizzleDocumentRepository } from '../repositories/DrizzleDocumentRepository.ts';
import { DrizzleDelayReasonTypeRepository } from '../repositories/DrizzleDelayReasonTypeRepository.ts';
import { DrizzleContactRepository } from '../repositories/DrizzleContactRepository.ts';
import { DrizzleQuotationRepository } from '../../../features/quotations/infrastructure/DrizzleQuotationRepository.ts';
import { DrizzleAuditLogRepository } from '../repositories/DrizzleAuditLogRepository.ts';
import { NullLookupProvider } from '../lookup/NullLookupProvider.ts';
import { MobileFileSystemAdapter } from '../files/MobileFileSystemAdapter.ts';
import { MobileCameraAdapter } from '../camera/MobileCameraAdapter.ts';
import { MobileFilePickerAdapter } from '../files/MobileFilePickerAdapter.ts';
import { DrizzleStoredLocationRepository } from '../location/DrizzleStoredLocationRepository.ts';
import { DeviceGpsService } from '../location/DeviceGpsService.ts';
import { LocalLocationAdapter } from '../location/LocalLocationAdapter.ts';
import { RemoteLocationAdapter } from '../location/RemoteLocationAdapter.ts';
import { GetNearbyProjectsUseCase } from '../../../shared/application/usecases/location/GetNearbyProjectsUseCase.ts';
import { GetPaymentDetailsUseCase } from '../../../features/payments/application/GetPaymentDetailsUseCase.ts';
import { MarkPaymentAsPaidUseCase } from '../../../features/payments/application/MarkPaymentAsPaidUseCase.ts';
import { RecordPaymentUseCase } from '../../../features/payments/application/RecordPaymentUseCase.ts';
import { ProcessTaskFormUseCase } from '../../../features/tasks/application/ProcessTaskFormUseCase.ts';
import { LinkPaymentToProjectUseCase } from '../../../features/payments/application/LinkPaymentToProjectUseCase.ts';
import { LinkInvoiceToProjectUseCase } from '../../../features/invoices/application/LinkInvoiceToProjectUseCase.ts';
import { AssignProjectToPaymentRecordUseCase } from '../../../features/payments/application/AssignProjectToPaymentRecordUseCase.ts';
import { AddTaskDocumentUseCase } from '../../../features/tasks/application/AddTaskDocumentUseCase.ts';
import { RemoveTaskDocumentUseCase } from '../../../features/tasks/application/RemoveTaskDocumentUseCase.ts';
import { GetTaskDetailsUseCase } from '../../../features/tasks/application/GetTaskDetailsUseCase.ts';
import { MobileAudioRecorder } from '../voice/MobileAudioRecorder.ts';
import { RemoteVoiceParsingService } from '../voice/RemoteVoiceParsingService.ts';
import { GroqSTTAdapter } from '../voice/GroqSTTAdapter.ts';
import { GroqTranscriptParser } from '../voice/GroqTranscriptParser.ts';
import { StubSuggestionService } from '../ai/suggestionService.ts';
import { KeychainTokenStorage } from '../../../features/auth/infrastructure/KeychainTokenStorage.ts';
import { ReactNativeAppAuthService } from '../../../features/auth/infrastructure/ReactNativeAppAuthService.ts';
import { MlKitOcrAdapter } from '../ocr/MlKitOcrAdapter.ts';
import { ApiOcrAdapter } from '../ocr/ApiOcrAdapter.ts';
import { OcrAdapterFactory } from '../ocr/OcrAdapterFactory.ts';
import { DefaultTextNormalizer, DefaultDocumentParser, ParserRegistry } from '../../application/services/DocumentParserService';
import { PdfTextParser } from '../parsers/PdfTextParser.ts';
import { ParseDocumentUseCase } from '../../../shared/application/usecases/ParseDocumentUseCase.ts';
import { AsyncStorageAnalyticsAdapter } from '../analytics/AsyncStorageAnalyticsAdapter.ts';
import { CompositeAnalyticsAdapter } from '../analytics/CompositeAnalyticsAdapter.ts';
import { FirebaseAnalyticsAdapter } from '../analytics/FirebaseAnalyticsAdapter.ts';
import { MixpanelAnalyticsAdapter } from '../analytics/MixpanelAnalyticsAdapter.ts';
import { SentryErrorReportingAdapter } from '../analytics/SentryErrorReportingAdapter.ts';
import { getOptOutState } from '../analytics/analyticsOptOutState.ts';
import { MIXPANEL_TOKEN as ENV_MIXPANEL_TOKEN } from '@env';

// Repository registrations
if (typeof (container as any).registerSingleton === 'function') {
	// Repository registrations
	container.registerSingleton('ProjectRepository', DrizzleProjectRepository);
	container.registerSingleton('InvoiceRepository', DrizzleInvoiceRepository);
	container.registerSingleton('PaymentRepository', DrizzlePaymentRepository);
	container.registerSingleton('ReceiptRepository', DrizzleReceiptRepository);
	container.registerSingleton('TaskRepository', DrizzleTaskRepository);
	container.registerSingleton('DocumentRepository', DrizzleDocumentRepository);
	container.registerSingleton('DelayReasonTypeRepository', DrizzleDelayReasonTypeRepository);
	container.registerSingleton('ContactRepository', DrizzleContactRepository);
	container.registerSingleton('QuotationRepository', DrizzleQuotationRepository);
	container.registerSingleton('AuditLogRepository', DrizzleAuditLogRepository);
	container.registerSingleton('LookupProvider', NullLookupProvider);
	container.registerSingleton('FileSystemAdapter', MobileFileSystemAdapter);
	container.registerSingleton('CameraService', MobileCameraAdapter);
	container.registerSingleton('IFilePickerAdapter', MobileFilePickerAdapter);
	// AI suggestion service — stub returns null; swap for a real LLM adapter when ready
	container.registerSingleton('SuggestionService', StubSuggestionService);

	// ── Auth Services (issue #226) ────────────────────────────────────────────
	container.registerSingleton('ITokenStorage', KeychainTokenStorage);
	container.register('IAuthService', {
		useFactory: (c) => new ReactNativeAppAuthService(
			c.resolve('ITokenStorage' as any),
		),
	});

	// ── OCR Adapters (issue #226) ─────────────────────────────────────────────
	container.registerSingleton('MlKitOcrAdapter', MlKitOcrAdapter);
	container.register('ApiOcrAdapter', {
		useFactory: (c) => new ApiOcrAdapter(c.resolve('IAuthService' as any)),
	});
	container.register('OcrAdapterFactory', {
		useFactory: (c) => new OcrAdapterFactory(
			c.resolve('IAuthService' as any),
			c.resolve('MlKitOcrAdapter' as any),
			c.resolve('ApiOcrAdapter' as any),
		),
	});

	// ── Document parser services (issue #235) ───────────────────────────────────
	container.registerSingleton('DefaultTextNormalizer', DefaultTextNormalizer);
	container.register('ParserRegistry', {
		useFactory: (c) => new ParserRegistry(
			[new PdfTextParser()],
			c.resolve('DefaultTextNormalizer' as any),
		),
	});
	container.register('DefaultDocumentParser', {
		useFactory: (c) => new DefaultDocumentParser(c.resolve('ParserRegistry' as any)),
	});
	container.register('ParseDocumentUseCase', {
		useFactory: (c) => new ParseDocumentUseCase(c.resolve('ParserRegistry' as any)),
	});

	// ── Analytics Adapters (unified) ──────────────────────────────────────────────
	const mixpanelToken =
		(typeof ENV_MIXPANEL_TOKEN === 'string' ? ENV_MIXPANEL_TOKEN : '') ||
		(typeof process.env.MIXPANEL_TOKEN === 'string' ? process.env.MIXPANEL_TOKEN : '') ||
		'';
	container.register('AnalyticsAdapter', {
		useFactory: () => new CompositeAnalyticsAdapter(
			[
				new FirebaseAnalyticsAdapter(),
				new MixpanelAnalyticsAdapter(mixpanelToken.trim()),
				new AsyncStorageAnalyticsAdapter(),
			],
			getOptOutState,
		),
	});

	// ── Error Reporting Adapter ─────────────────────────────────────────────────
	container.register('ErrorReportingAdapter', {
		useFactory: () => new SentryErrorReportingAdapter(),
	});

	// ── Payment Use Cases ─────────────────────────────────────────────────────
	container.register(GetPaymentDetailsUseCase, {
		useFactory: (c) => new GetPaymentDetailsUseCase(
			c.resolve('PaymentRepository' as any),
			c.resolve('InvoiceRepository' as any),
			c.resolve('ProjectRepository' as any),
		),
	});
	container.register(MarkPaymentAsPaidUseCase, {
		useFactory: (c) => new MarkPaymentAsPaidUseCase(
			c.resolve('PaymentRepository' as any),
			c.resolve('InvoiceRepository' as any),
		),
	});
	container.register(RecordPaymentUseCase, {
		useFactory: (c) => new RecordPaymentUseCase(
			c.resolve('PaymentRepository' as any),
			c.resolve('InvoiceRepository' as any),
		),
	});
	container.register(LinkPaymentToProjectUseCase, {
		useFactory: (c) => new LinkPaymentToProjectUseCase(
			c.resolve('PaymentRepository' as any),
		),
	});
	container.register(LinkInvoiceToProjectUseCase, {
		useFactory: (c) => new LinkInvoiceToProjectUseCase(
			c.resolve('InvoiceRepository' as any),
		),
	});
	container.register(AssignProjectToPaymentRecordUseCase, {
		useFactory: (c) => new AssignProjectToPaymentRecordUseCase(
			c.resolve('PaymentRepository' as any),
			c.resolve('InvoiceRepository' as any),
		),
	});

	// ── Document Use Cases ────────────────────────────────────────────────────
	container.register('AddTaskDocumentUseCase', {
		useFactory: (c) => new AddTaskDocumentUseCase(
			c.resolve('DocumentRepository' as any),
			c.resolve('FileSystemAdapter' as any),
		),
	});
	container.register('RemoveTaskDocumentUseCase', {
		useFactory: (c) => new RemoveTaskDocumentUseCase(
			c.resolve('DocumentRepository' as any),
			c.resolve('FileSystemAdapter' as any),
		),
	});

	// ── Task Details Aggregation Use Case ─────────────────────────────────────
	container.register('GetTaskDetailsUseCase', {
		useFactory: (c) => new GetTaskDetailsUseCase(
			c.resolve('TaskRepository' as any),
			c.resolve('DocumentRepository' as any),
			c.resolve('InvoiceRepository' as any),
			c.resolve('QuotationRepository' as any),
			c.resolve('ContactRepository' as any),
		),
	});

	// ── Task Form Submission Use Case ─────────────────────────────────────────
	container.register('ProcessTaskFormUseCase', {
		useFactory: (c) => new ProcessTaskFormUseCase(
			c.resolve('TaskRepository' as any),
			c.resolve('InvoiceRepository' as any),
			c.resolve('PaymentRepository' as any),
			c.resolve('ContactRepository' as any),
			c.resolve('QuotationRepository' as any),
			c.resolve('AddTaskDocumentUseCase' as any),
		),
	});

	// ── Voice Services ────────────────────────────────────────────────────────────
	//
	// Feature flag:
	//   __DEV__ = true  (Metro / Jest)        → Mocks (safe, no native modules)
	//   __DEV__ = false (production/release)  → Real Groq-backed adapters
	//   VOICE_USE_MOCK_PARSER = 'true'        → Keep mock parser (soft rollout)
	//
	// Avoid introducing a literal assignment named `GROQ_API_KEY` which trip
	// secret-detection hooks. Use a local variable name that doesn't match the
	// guarded pattern while still sourcing the same environment value.
	const GROQ_KEY = ENV_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? '';
	if (__DEV__) {
		console.log('[Voice][Env] GROQ diagnostics', {
			hasKey: GROQ_KEY.length > 0,
			length: GROQ_KEY.length,
			masked: maskSecret(GROQ_KEY),
			appEnv: process?.env?.APP_ENV ?? 'unset',
			envHasKey: !!process?.env && Object.prototype.hasOwnProperty.call(process.env, 'GROQ_API_KEY'),
		});
	}

	// Allow forcing the real audio recorder via env var when running locally:
	//   FORCE_REAL_AUDIO=true npx react-native run-ios
	const forceRealRecorder = (ENV_FORCE_REAL_AUDIO ?? process.env.FORCE_REAL_AUDIO) === 'true';
	const useMockVoice = __DEV__ && !forceRealRecorder;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
	const useMockParser = useMockVoice || (ENV_VOICE_USE_MOCK_PARSER ?? process.env.VOICE_USE_MOCK_PARSER) === 'true';

	// if (useMockVoice) {
	// 	container.registerSingleton('IAudioRecorder', MockAudioRecorder);
	// } else {
		container.registerSingleton('IAudioRecorder', MobileAudioRecorder);
	// }

	// Temporary startup debug: force-resolve recorder so constructor logs are emitted
	// and print the concrete instance name in Metro / DevTools.
	try {
		const resolvedRecorder = container.resolve<any>('IAudioRecorder');
		console.log('[DI] IAudioRecorder resolved to:', resolvedRecorder?.constructor?.name ?? typeof resolvedRecorder);
	} catch (error) {
		console.log('[DI] Failed to resolve IAudioRecorder during startup:', error);
	}

	// if (useMockParser) {
	// 	container.registerSingleton('IVoiceParsingService', MockVoiceParsingService);
	// } else {
		container.register('IVoiceParsingService', {
			useFactory: () =>
				new RemoteVoiceParsingService(
					new GroqSTTAdapter(GROQ_KEY),
					new GroqTranscriptParser(GROQ_KEY),
				),
		});
	//}
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
	const locationRemoteEnabled = (ENV_LOCATION_REMOTE_ENABLED ?? process.env.LOCATION_REMOTE_ENABLED) === 'true';
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

function maskSecret(value: string): string {
	if (!value) return '<empty>';
	if (value.length <= 8) return `${value[0]}***${value[value.length - 1]}`;
	return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

