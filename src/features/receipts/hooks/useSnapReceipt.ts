import { useMemo, useState } from 'react';
import { container } from 'tsyringe';
import { SnapReceiptUseCase, SnapReceiptDTO } from '../application/SnapReceiptUseCase';
import { ReceiptRepository } from '../domain/ReceiptRepository';
import { NormalizedReceipt } from '../application/IReceiptNormalizer';
import { MobileOcrAdapter } from '../../../infrastructure/ocr/MobileOcrAdapter';
import { ReceiptFieldParser } from '../application/ReceiptFieldParser';
import { DeterministicReceiptNormalizer } from '../application/DeterministicReceiptNormalizer';
import { IReceiptParsingStrategy } from '../application/IReceiptParsingStrategy';
import {
    ProcessReceiptUploadUseCase,
    ProcessReceiptUploadInput,
} from '../application/ProcessReceiptUploadUseCase';
import { PdfThumbnailConverter } from '../../../infrastructure/files/PdfThumbnailConverter';
import { FeatureFlags } from '../../../infrastructure/config/featureFlags';
import { LlmVisionReceiptParser } from '../infrastructure/LlmVisionReceiptParser';
import { ReactNativeImageReader } from '../../../infrastructure/files/ReactNativeImageReader';
import { GROQ_API_KEY } from '@env';
import '../../../infrastructure/di/registerServices';

export const useSnapReceipt = (
    enableOcr: boolean = false,
    receiptParsingStrategy?: IReceiptParsingStrategy,
) => {
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

    // PDF upload use case — instantiated only when a parsing strategy is supplied.
    // When useVisionOcr is true, also injects a vision strategy so the use case
    // skips ML Kit OCR and sends the image directly to the Groq Vision model.
    const pdfUploadUseCase = useMemo(() => {
        if (!receiptParsingStrategy) return null;
        const ocrAdapter = new MobileOcrAdapter();
        const visionStrategy =
            FeatureFlags.useVisionOcr && GROQ_API_KEY
                ? new LlmVisionReceiptParser(GROQ_API_KEY, new ReactNativeImageReader())
                : undefined;
        return new ProcessReceiptUploadUseCase(
            ocrAdapter,
            receiptParsingStrategy,
            new PdfThumbnailConverter(),
            undefined,
            visionStrategy,
        );
    }, [receiptParsingStrategy]);

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

    const processPdfReceipt = async (
        input: ProcessReceiptUploadInput,
    ): Promise<NormalizedReceipt | null> => {
        if (!pdfUploadUseCase) {
            setError('PDF parsing is not configured. Please set up a parsing strategy.');
            return null;
        }

        setProcessing(true);
        setError(null);
        try {
            const output = await pdfUploadUseCase.execute(input);
            return output.normalized;
        } catch (e: any) {
            setError(e.message || 'Failed to process PDF receipt');
            return null;
        } finally {
            setProcessing(false);
        }
    };

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
        processPdfReceipt,
        saveNormalizedReceipt,
        loading, 
        processing,
        error 
    };
};
