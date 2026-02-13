import React, { useState } from 'react';
import { View, Alert, Text, Pressable, TextInput } from 'react-native';
import { ReceiptForm } from '../../components/receipts/ReceiptForm';
import { useSnapReceipt } from '../../hooks/useSnapReceipt';
import { NormalizedReceipt } from '../../application/receipt/IReceiptNormalizer';
import { Camera } from 'lucide-react-native';

interface Props {
    onClose: () => void;
    enableOcr?: boolean;  // Feature flag for OCR
    imageUri?: string;    // Pre-captured image URI (for camera integration)
}

export const SnapReceiptScreen = ({ onClose, enableOcr = false, imageUri }: Props) => {
    const { saveReceipt, processReceipt, loading, processing, error } = useSnapReceipt(enableOcr);
    const [normalizedData, setNormalizedData] = useState<NormalizedReceipt | null>(null);
    const [testImageUri, setTestImageUri] = useState('');
    const [hasProcessed, setHasProcessed] = useState(false);

    // Process image URI when provided (from camera/gallery)
    React.useEffect(() => {
        if (imageUri && enableOcr && !hasProcessed) {
            (async () => {
                const result = await processReceipt(imageUri);
                if (result) {
                    setNormalizedData(result);
                } else {
                    Alert.alert('OCR Error', error || 'Could not extract receipt data. Please enter manually.');
                }
            })();
            setHasProcessed(true);
        }
    }, [imageUri, enableOcr, hasProcessed, processReceipt, error]);

    const handleProcessImage = async (uri: string) => {
        const result = await processReceipt(uri);
        if (result) {
            setNormalizedData(result);
        } else {
            Alert.alert('OCR Error', error || 'Could not extract receipt data. Please enter manually.');
        }
    };

    const handleSave = async (data: any) => {
        console.log('[SnapReceiptScreen] handleSave - start', { vendor: data.vendor, amount: data.amount, date: data.date });
        const result = await saveReceipt(data);
        console.log('[SnapReceiptScreen] handleSave - result', result);

        if (result.success) {
            console.log('[SnapReceiptScreen] Save succeeded, closing screen');
            Alert.alert('Success', 'Receipt saved successfully');
            onClose();
        } else {
            console.warn('[SnapReceiptScreen] Save failed', result.error);
            Alert.alert('Error', result.error || 'Failed to save');
        }
    };

    // Show OCR testing UI if enabled but no image provided yet
    if (enableOcr && !imageUri && !normalizedData) {
        return (
            <View className="flex-1 bg-background p-4 pt-8">
                <Text className="text-2xl font-bold mb-4 text-foreground">Snap Receipt (OCR Enabled)</Text>
                
                {/* Mock image URI input for testing - will be replaced with camera */}
                <View className="mb-4">
                    <Text className="text-sm text-muted-foreground mb-2">
                        OCR Testing: Enter image URI or use camera button
                    </Text>
                    <TextInput
                        className="border border-input rounded-xl p-4 bg-card text-foreground mb-4"
                        value={testImageUri}
                        onChangeText={setTestImageUri}
                        placeholder="file:///path/to/image.jpg"
                        placeholderTextColor="#9ca3af"
                    />
                    
                    <Pressable
                        onPress={() => testImageUri && handleProcessImage(testImageUri)}
                        disabled={!testImageUri || processing}
                        className="bg-primary p-4 rounded-xl items-center flex-row justify-center active:opacity-80"
                    >
                        <Camera size={20} color="white" />
                        <Text className="text-primary-foreground font-bold ml-2">
                            {processing ? 'Processing...' : 'Process Receipt'}
                        </Text>
                    </Pressable>
                </View>
                
                <View className="border-t border-border pt-4 mt-4">
                    <Text className="text-muted-foreground text-center mb-4">Or enter manually</Text>
                    <ReceiptForm 
                        onSubmit={handleSave} 
                        onCancel={onClose} 
                        isLoading={loading}
                    />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background pt-8">
            <ReceiptForm 
                onSubmit={handleSave} 
                onCancel={onClose} 
                isLoading={loading}
                isProcessing={processing}
                normalizedData={normalizedData || undefined}
            />
        </View>
    );
};
