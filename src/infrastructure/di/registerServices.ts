import 'reflect-metadata';
import { container } from 'tsyringe';
import { DrizzleProjectRepository } from '../repositories/DrizzleProjectRepository';
import { DrizzleInvoiceRepository } from '../repositories/DrizzleInvoiceRepository';
import { DrizzlePaymentRepository } from '../repositories/DrizzlePaymentRepository';
import { DrizzleReceiptRepository } from '../repositories/DrizzleReceiptRepository';
import { DrizzleTaskRepository } from '../repositories/DrizzleTaskRepository';
import { MockAudioRecorder } from '../voice/MockAudioRecorder';
import { MockVoiceParsingService } from '../voice/MockVoiceParsingService';

// Register default implementations
container.registerSingleton('ProjectRepository', DrizzleProjectRepository);
container.registerSingleton('InvoiceRepository', DrizzleInvoiceRepository);
container.registerSingleton('PaymentRepository', DrizzlePaymentRepository);
container.registerSingleton('ReceiptRepository', DrizzleReceiptRepository);
container.registerSingleton('TaskRepository', DrizzleTaskRepository);

// Voice services — currently backed by mocks (swap for production adapters when available)
container.registerSingleton('IAudioRecorder', MockAudioRecorder);
container.registerSingleton('IVoiceParsingService', MockVoiceParsingService);

export default container;

