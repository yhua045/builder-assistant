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

// Register default implementations
container.registerSingleton('ProjectRepository', DrizzleProjectRepository);
container.registerSingleton('InvoiceRepository', DrizzleInvoiceRepository);
container.registerSingleton('PaymentRepository', DrizzlePaymentRepository);
container.registerSingleton('ReceiptRepository', DrizzleReceiptRepository);
container.registerSingleton('TaskRepository', DrizzleTaskRepository);
container.registerSingleton('DocumentRepository', DrizzleDocumentRepository);
container.registerSingleton('FileSystemAdapter', MobileFileSystemAdapter);
container.registerSingleton('CameraService', MobileCameraAdapter);

export default container;
