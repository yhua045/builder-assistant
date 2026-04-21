import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ReceiptForm } from '../../components/receipts/ReceiptForm';
import { Camera, FileText, Pencil } from 'lucide-react-native';
import { IReceiptParsingStrategy } from '../../application/receipt/IReceiptParsingStrategy';
import { ICameraAdapter } from '../../infrastructure/camera/ICameraAdapter';
import { useSnapReceiptScreen } from '../../hooks/useSnapReceiptScreen';

interface Props {
    onClose: () => void;
    enableOcr?: boolean;
    imageUri?: string;
    /** LLM parsing strategy — required for PDF upload to extract line items */
    receiptParsingStrategy?: IReceiptParsingStrategy;
    /** Camera adapter override — for testing only */
    cameraAdapter?: ICameraAdapter;
}

export const SnapReceiptScreen = ({
    onClose,
    enableOcr = false,
    imageUri,
    receiptParsingStrategy,
    cameraAdapter,
}: Props) => {
    const vm = useSnapReceiptScreen({ onClose, enableOcr, imageUri, receiptParsingStrategy, cameraAdapter });

    if (vm.view === "processing") {
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

    if (vm.view === "form") {
        return (
            <View className="flex-1 bg-background pt-8">
                <ReceiptForm
                    onSubmit={vm.handleSave}
                    onCancel={onClose}
                    isLoading={vm.loading}
                    isProcessing={vm.processing}
                    normalizedData={vm.normalizedData ?? undefined}
                    initialValues={vm.formInitialValues}
                />
            </View>
        );
    }

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
            <Pressable
                testID="snap-photo-option"
                onPress={vm.handleSnapPhoto}
                disabled={vm.isCapturing || vm.processing}
                className="bg-card border border-border rounded-2xl p-5 mb-4 flex-row items-center active:opacity-70"
            >
                <View className="bg-blue-500/10 p-3 rounded-xl mr-4">
                    {vm.isCapturing ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                    ) : (
                        <Camera size={26} color="#3b82f6" />
                    )}
                </View>
                <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base mb-0.5">
                        {vm.isCapturing ? "Opening Camera…" : "Snap Photo"}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                        Take a photo of your receipt
                    </Text>
                </View>
            </Pressable>
            <Pressable
                testID="upload-pdf-option"
                onPress={vm.handleUploadPdf}
                disabled={vm.processing}
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
            <Pressable
                testID="manual-entry-option"
                onPress={vm.handleManualEntry}
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
