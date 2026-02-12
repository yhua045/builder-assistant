import { useMemo, useState } from 'react';
import { container } from 'tsyringe';
import { SnapReceiptUseCase, SnapReceiptDTO } from '../application/usecases/receipt/SnapReceiptUseCase';
import { ReceiptRepository } from '../domain/repositories/ReceiptRepository';
import { NormalizedReceipt } from '../application/receipt/IReceiptNormalizer';
import { MobileOcrAdapter } from '../infrastructure/ocr/MobileOcrAdapter';
import { ReceiptFieldParser } from '../application/receipt/ReceiptFieldParser';
import { DeterministicReceiptNormalizer } from '../application/receipt/DeterministicReceiptNormalizer';
import '../infrastructure/di/registerServices';

export const useSnapReceipt = (enableOcr: boolean = false) => {
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const receiptRepo = useMemo(() => container.resolve<ReceiptRepository>('ReceiptRepository'), []);
    
    const useCase = useMemo(() => {
        if (enableOcr) {
            // Wire up OCR pipeline with production-ready DeterministicReceiptNormalizer
            return new SnapReceiptUseCase(
                receiptRepo,
                new MobileOcrAdapter(),
                new ReceiptFieldParser(),
                new DeterministicReceiptNormalizer()  // ✅ Production-ready rules-based normalizer
            );
        }
        // Manual entry only
        return new SnapReceiptUseCase(receiptRepo);
    }, [receiptRepo, enableOcr]);

    const processReceipt = async (imageUri: string): Promise<NormalizedReceipt | null> => {
        if (!enableOcr) {
            setError('OCR feature is not enabled');
            return null;
        }

        setProcessing(true);
        setError(null);
        try {
            const normalized = await useCase.processReceipt(imageUri);
            return normalized;
        } catch (e: any) {
            setError(e.message || 'Failed to process receipt');
            return null;
        } finally {
            setProcessing(false);
        }
    };

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

    const saveNormalizedReceipt = async (
        normalizedReceipt: NormalizedReceipt,
        paymentMethod: 'cash' | 'card' | 'bank' | 'other',
        projectId?: string
    ) => {
        if (!enableOcr) {
            setError('OCR feature is not enabled');
            return false;
        }

        setLoading(true);
        setError(null);
        try {
            await useCase.saveReceipt(normalizedReceipt, paymentMethod, projectId);
            return true;
        } catch (e: any) {
            setError(e.message || 'Failed to save receipt');
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { 
        saveReceipt, 
        processReceipt,
        saveNormalizedReceipt,
        loading, 
        processing,
        error 
    };
};
