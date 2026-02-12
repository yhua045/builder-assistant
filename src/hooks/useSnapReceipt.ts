import { useMemo, useState } from 'react';
import { container } from 'tsyringe';
import { SnapReceiptUseCase, SnapReceiptDTO } from '../application/usecases/receipt/SnapReceiptUseCase';
import { ReceiptRepository } from '../domain/repositories/ReceiptRepository';
import '../infrastructure/di/registerServices';

export const useSnapReceipt = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const receiptRepo = useMemo(() => container.resolve<ReceiptRepository>('ReceiptRepository'), []);
    const useCase = useMemo(() => new SnapReceiptUseCase(receiptRepo), [receiptRepo]);

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
