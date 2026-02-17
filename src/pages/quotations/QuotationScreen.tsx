import React from 'react';
import { Modal, View, Alert } from 'react-native';
import { QuotationForm } from '../../components/quotations/QuotationForm';
import { useQuotations } from '../../hooks/useQuotations';
import { Quotation, QuotationEntity } from '../../domain/entities/Quotation';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
}

export const QuotationScreen: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const { createQuotation, loading } = useQuotations();

  const handleSubmit = async (data: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Validate with entity before submission
      const entity = QuotationEntity.create(data as any);
      const validated = entity.data();
      
      // Create quotation
      const created = await createQuotation(validated);
      
      Alert.alert('Success', 'Quotation created successfully');
      onSuccess?.(created);
      onClose();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create quotation');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1">
        <QuotationForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={loading}
        />
      </View>
    </Modal>
  );
};
