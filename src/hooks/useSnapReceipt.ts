import { useMemo, useState } from 'react';
import { container } from 'tsyringe';
import { SnapReceiptUseCase, SnapReceiptDTO } from '../application/usecases/receipt/SnapReceiptUseCase';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import '../infrastructure/di/registerServices';

export const useSnapReceipt = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const invoiceRepo = useMemo(() => container.resolve<InvoiceRepository>('InvoiceRepository'), []);
    const paymentRepo = useMemo(() => container.resolve<PaymentRepository>('PaymentRepository'), []);
    const useCase = useMemo(() => new SnapReceiptUseCase(invoiceRepo, paymentRepo), [invoiceRepo, paymentRepo]);

    const saveReceipt = async (data: SnapReceiptDTO) => {
        setLoading(true);
        setError(null);
        try {
            await useCase.execute(data);
            return true;
        } catch (e: any) {
            setError(e.message || 'Failed to save receipt');
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { saveReceipt, loading, error };
};
