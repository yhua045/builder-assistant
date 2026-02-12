import 'reflect-metadata';
import { container } from 'tsyringe';
import { DrizzleProjectRepository } from '../repositories/DrizzleProjectRepository';
import { DrizzleInvoiceRepository } from '../repositories/DrizzleInvoiceRepository';
import { DrizzlePaymentRepository } from '../repositories/DrizzlePaymentRepository';
import { DrizzleReceiptRepository } from '../repositories/DrizzleReceiptRepository';

// Register default implementations
container.registerSingleton('ProjectRepository', DrizzleProjectRepository);
container.registerSingleton('InvoiceRepository', DrizzleInvoiceRepository);
container.registerSingleton('PaymentRepository', DrizzlePaymentRepository);
container.registerSingleton('ReceiptRepository', DrizzleReceiptRepository);

export default container;
