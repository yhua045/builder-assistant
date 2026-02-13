import React from 'react';
import { View, Alert } from 'react-native';
import { ReceiptForm } from '../../components/receipts/ReceiptForm';
import { useSnapReceipt } from '../../hooks/useSnapReceipt';

interface Props {
    onClose: () => void;
}

export const SnapReceiptScreen = ({ onClose }: Props) => {
    const { saveReceipt, loading, error } = useSnapReceipt();

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

    return (
        <View className="flex-1 bg-background pt-8">
            <ReceiptForm 
                onSubmit={handleSave} 
                onCancel={onClose} 
                isLoading={loading}
            />
        </View>
    );
};
