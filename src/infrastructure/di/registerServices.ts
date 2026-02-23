import 'reflect-metadata';
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

// Register default implementations
container.registerSingleton('ProjectRepository', DrizzleProjectRepository);
container.registerSingleton('InvoiceRepository', DrizzleInvoiceRepository);
container.registerSingleton('PaymentRepository', DrizzlePaymentRepository);
container.registerSingleton('ReceiptRepository', DrizzleReceiptRepository);
container.registerSingleton('TaskRepository', DrizzleTaskRepository);
container.registerSingleton('DocumentRepository', DrizzleDocumentRepository);
container.registerSingleton('FileSystemAdapter', MobileFileSystemAdapter);
container.registerSingleton('CameraService', MobileCameraAdapter);

// Voice services — currently backed by mocks (swap for production adapters when available)
container.registerSingleton('IAudioRecorder', MockAudioRecorder);
container.registerSingleton('IVoiceParsingService', MockVoiceParsingService);

// Location services
container.registerSingleton('StoredLocationRepository', DrizzleStoredLocationRepository);
container.registerSingleton('GpsService', DeviceGpsService);

export default container;

