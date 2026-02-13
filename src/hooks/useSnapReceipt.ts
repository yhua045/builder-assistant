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
        console.log('[useSnapReceipt] saveReceipt - start', { vendor: data.vendor, amount: data.amount, date: data.date });
        try {
            await useCase.execute(data);
            console.log('[useSnapReceipt] saveReceipt - success');
            return { success: true } as const;
        } catch (e: any) {
            const msg = e?.message || 'Failed to save receipt';
            console.warn('[useSnapReceipt] saveReceipt - error', msg, e);
            setError(msg);
            return { success: false, error: msg } as const;
        } finally {
            setLoading(false);
            console.log('[useSnapReceipt] saveReceipt - end');
        }
    };

    return { saveReceipt, loading, error };
};
