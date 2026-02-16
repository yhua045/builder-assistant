import React, { useState } from 'react';
import { View, Alert, Text, Pressable, ActivityIndicator } from 'react-native';
import { ReceiptForm } from '../../components/receipts/ReceiptForm';
import { useSnapReceipt } from '../../hooks/useSnapReceipt';
import { NormalizedReceipt } from '../../application/receipt/IReceiptNormalizer';
import { Camera } from 'lucide-react-native';
import { ICameraAdapter } from '../../infrastructure/camera/ICameraAdapter';
import { MobileCameraAdapter } from '../../infrastructure/camera/MobileCameraAdapter';

interface Props {
    onClose: () => void;
    enableOcr?: boolean;  // Feature flag for OCR
    imageUri?: string;    // Pre-captured image URI (for camera integration)
    cameraAdapter?: ICameraAdapter; // Optional camera adapter for dependency injection (testing)
}

export const SnapReceiptScreen = ({ onClose, enableOcr = false, imageUri, cameraAdapter }: Props) => {
    const { saveReceipt, processReceipt, loading, processing, error } = useSnapReceipt(enableOcr);
    const [normalizedData, setNormalizedData] = useState<NormalizedReceipt | null>(null);
    const [hasProcessed, setHasProcessed] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    
    // Use provided camera adapter or create default instance
    const camera = cameraAdapter || new MobileCameraAdapter();

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

    const handleCameraCapture = async () => {
        try {
            setIsCapturing(true);
            const result = await camera.capturePhoto();
            
            // User cancelled
            if (result.cancelled) {
                setIsCapturing(false);
                return;
            }
            
            // Process the captured image with OCR
            const normalizedResult = await processReceipt(result.uri);
            if (normalizedResult) {
                setNormalizedData(normalizedResult);
            } else {
                Alert.alert('OCR Error', error || 'Could not extract receipt data. Please enter manually.');
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Camera error occurred';
            
            // Provide user-friendly error messages
            if (errorMessage.toLowerCase().includes('permission')) {
                Alert.alert(
                    'Camera Error',
                    'Camera access is required to scan receipts. Please enable camera permissions in your device settings.'
                );
            } else if (errorMessage.toLowerCase().includes('not available')) {
                Alert.alert(
                    'Camera Error',
                    'Camera is not available on this device. Please enter receipt details manually.'
                );
            } else {
                Alert.alert('Camera Error', errorMessage);
            }
        } finally {
            setIsCapturing(false);
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

    // Show camera capture UI if enabled but no image provided yet
    if (enableOcr && !imageUri && !normalizedData) {
        return (
            <View className="flex-1 bg-background p-4 pt-8">
                <Text className="text-2xl font-bold mb-4 text-foreground">Snap Receipt</Text>
                
                {/* Camera capture button */}
                <View className="mb-4">
                    <Text className="text-sm text-muted-foreground mb-4">
                        Capture a photo of your receipt to automatically extract details
                    </Text>
                    
                    <Pressable
                        testID="camera-button"
                        onPress={handleCameraCapture}
                        disabled={isCapturing || processing}
                        className="bg-primary p-4 rounded-xl items-center flex-row justify-center active:opacity-80 mb-6"
                    >
                        {isCapturing ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Camera size={24} color="white" />
                        )}
                        <Text className="text-primary-foreground font-bold ml-2 text-lg">
                            {isCapturing ? 'Opening Camera...' : processing ? 'Processing...' : 'Open Camera'}
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
