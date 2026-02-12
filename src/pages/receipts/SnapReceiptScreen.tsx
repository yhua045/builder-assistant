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
        const success = await saveReceipt(data);
        if (success) {
            Alert.alert('Success', 'Receipt saved successfully');
            onClose();
        } else {
            Alert.alert('Error', error || 'Failed to save');
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
