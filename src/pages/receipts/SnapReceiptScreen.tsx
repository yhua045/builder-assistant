import React, { useState } from 'react';
import { View, Alert, Text, Pressable, ActivityIndicator } from 'react-native';
import { ReceiptForm } from '../../components/receipts/ReceiptForm';
import { useSnapReceipt } from '../../hooks/useSnapReceipt';
import { NormalizedReceipt } from '../../application/receipt/IReceiptNormalizer';
import { SnapReceiptDTO } from '../../application/usecases/receipt/SnapReceiptUseCase';
import { normalizedReceiptToFormValues } from '../../utils/normalizedReceiptToFormValues';
import { Camera, FileText, Pencil } from 'lucide-react-native';
import { ICameraAdapter } from '../../infrastructure/camera/ICameraAdapter';
import { MobileCameraAdapter } from '../../infrastructure/camera/MobileCameraAdapter';
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { MobileFilePickerAdapter } from '../../infrastructure/files/MobileFilePickerAdapter';
import { IReceiptParsingStrategy } from '../../application/receipt/IReceiptParsingStrategy';

type ScreenView = 'selecting' | 'capturing' | 'processing' | 'form';

interface Props {
    onClose: () => void;
    enableOcr?: boolean;
    imageUri?: string;
    cameraAdapter?: ICameraAdapter;
    filePickerAdapter?: IFilePickerAdapter;
    /** LLM parsing strategy — required for PDF upload to extract line items */
    receiptParsingStrategy?: IReceiptParsingStrategy;
}

export const SnapReceiptScreen = ({
    onClose,
    enableOcr = false,
    imageUri,
    cameraAdapter,
    filePickerAdapter,
    receiptParsingStrategy,
}: Props) => {
    const { saveReceipt, processReceipt, processPdfReceipt, loading, processing, error } =
        useSnapReceipt(enableOcr, receiptParsingStrategy);

    const [view, setView] = useState<ScreenView>(
        // If a pre-captured imageUri was supplied, skip straight to processing
        imageUri ? 'capturing' : 'selecting',
    );
    const [normalizedData, setNormalizedData] = useState<NormalizedReceipt | null>(null);
    const [formInitialValues, setFormInitialValues] = useState<Partial<SnapReceiptDTO> | undefined>(undefined);
    const [isCapturing, setIsCapturing] = useState(false);

    const camera = cameraAdapter ?? new MobileCameraAdapter();
    const filePicker = filePickerAdapter ?? new MobileFilePickerAdapter();

    // Process pre-supplied imageUri on mount (existing integration path)
    React.useEffect(() => {
        if (imageUri && enableOcr && view === 'capturing') {
            (async () => {
                setView('processing');
                const result = await processReceipt(imageUri);
                if (result) {
                    setNormalizedData(result);
                    setFormInitialValues(normalizedReceiptToFormValues(result));
                } else {
                    Alert.alert('OCR Error', error || 'Could not extract receipt data. Please enter manually.');
                }
                setView('form');
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Option handlers ────────────────────────────────────────────────────

    const handleSnapPhoto = async () => {
        try {
            setIsCapturing(true);
            const result = await camera.capturePhoto();
            if (result.cancelled) {
                setIsCapturing(false);
                return;
            }
            setView('processing');
            const normalizedResult = await processReceipt(result.uri);
            if (normalizedResult) {
                setNormalizedData(normalizedResult);
                setFormInitialValues(normalizedReceiptToFormValues(normalizedResult));
            } else {
                Alert.alert('OCR Error', error || 'Could not extract receipt data. Please enter manually.');
            }
            setView('form');
        } catch (err: any) {
            const msg = err?.message || 'Camera error occurred';
            if (msg.toLowerCase().includes('permission')) {
                Alert.alert('Camera Permission', 'Enable camera access in your device settings to snap receipts.');
            } else if (msg.toLowerCase().includes('not available')) {
                Alert.alert('Camera Unavailable', 'Camera is not available on this device. Please enter details manually.');
            } else {
                Alert.alert('Camera Error', msg);
            }
            setView('selecting');
        } finally {
            setIsCapturing(false);
        }
    };

    const handleUploadPdf = async () => {
        try {
            const picked = await filePicker.pickDocument();
            if (picked.cancelled || !picked.uri) return;

            if (picked.type && picked.type !== 'application/pdf') {
                Alert.alert('Unsupported File', 'Please select a PDF file.');
                return;
            }

            setView('processing');
            const normalizedResult = await processPdfReceipt({
                fileUri: picked.uri,
                filename: picked.name ?? 'receipt.pdf',
                mimeType: picked.type ?? 'application/pdf',
                fileSize: picked.size ?? 0,
            });

            if (normalizedResult) {
                setNormalizedData(normalizedResult);
                setFormInitialValues(normalizedReceiptToFormValues(normalizedResult));
            } else {
                Alert.alert('Processing Error', error || 'Could not extract receipt data. Please enter manually.');
            }
            setView('form');
        } catch (err: any) {
            Alert.alert('Upload Error', err?.message || 'Failed to process PDF.');
            setView('selecting');
        }
    };

    const handleManualEntry = () => {
        setView('form');
    };

    const handleSave = async (data: SnapReceiptDTO) => {
        const result = await saveReceipt(data);
        if (result.success) {
            Alert.alert('Success', 'Receipt saved successfully');
            onClose();
        } else {
            Alert.alert('Error', result.error || 'Failed to save');
        }
    };

    // ── Views ──────────────────────────────────────────────────────────────

    if (view === 'processing') {
        return (
            <View className="flex-1 bg-background items-center justify-center p-8">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-lg text-foreground mt-4 font-semibold">
                    Extracting receipt details...
                </Text>
                <Text className="text-sm text-muted-foreground mt-2 text-center">
                    This may take a few seconds
                </Text>
            </View>
        );
    }

    if (view === 'form') {
        return (
            <View className="flex-1 bg-background pt-8">
                <ReceiptForm
                    onSubmit={handleSave}
                    onCancel={onClose}
                    isLoading={loading}
                    isProcessing={processing}
                    normalizedData={normalizedData ?? undefined}
                    initialValues={formInitialValues}
                />
            </View>
        );
    }

    // 'selecting' — three-option menu
    return (
        <View className="flex-1 bg-background p-6 pt-10">
            <View className="flex-row items-center justify-between mb-8">
                <Text className="text-2xl font-bold text-foreground">Snap Receipt</Text>
                <Pressable
                    testID="snap-receipt-close"
                    onPress={onClose}
                    className="p-2 rounded-md active:opacity-60"
                >
                    <Text className="text-muted-foreground text-base">✕</Text>
                </Pressable>
            </View>

            <Text className="text-sm text-muted-foreground mb-6">
                Choose how to capture your receipt:
            </Text>

            {/* Option 1: Snap Photo */}
            <Pressable
                testID="snap-photo-option"
                onPress={handleSnapPhoto}
                disabled={isCapturing || processing}
                className="bg-card border border-border rounded-2xl p-5 mb-4 flex-row items-center active:opacity-70"
            >
                <View className="bg-blue-500/10 p-3 rounded-xl mr-4">
                    {isCapturing ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                    ) : (
                        <Camera size={26} color="#3b82f6" />
                    )}
                </View>
                <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base mb-0.5">
                        {isCapturing ? 'Opening Camera…' : 'Snap Photo'}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                        Take a photo of your receipt
                    </Text>
                </View>
            </Pressable>

            {/* Option 2: Upload PDF */}
            <Pressable
                testID="upload-pdf-option"
                onPress={handleUploadPdf}
                disabled={processing}
                className="bg-card border border-border rounded-2xl p-5 mb-4 flex-row items-center active:opacity-70"
            >
                <View className="bg-green-500/10 p-3 rounded-xl mr-4">
                    <FileText size={26} color="#22c55e" />
                </View>
                <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base mb-0.5">
                        Upload PDF
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                        Pick a PDF receipt — details extracted automatically
                    </Text>
                </View>
            </Pressable>

            {/* Option 3: Enter Manually */}
            <Pressable
                testID="manual-entry-option"
                onPress={handleManualEntry}
                className="bg-card border border-border rounded-2xl p-5 flex-row items-center active:opacity-70"
            >
                <View className="bg-orange-500/10 p-3 rounded-xl mr-4">
                    <Pencil size={26} color="#f97316" />
                </View>
                <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base mb-0.5">
                        Enter Manually
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                        Fill in the receipt details yourself
                    </Text>
                </View>
            </Pressable>
        </View>
    );
};
