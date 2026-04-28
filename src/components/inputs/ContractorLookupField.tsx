import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { UserPlus } from 'lucide-react-native';
import { SubcontractorPickerModal, SubcontractorContact } from '../../features/tasks/components/SubcontractorPickerModal';

interface ContractorLookupFieldProps {
  label?: string;
  value: string;
  onChange: (value: string, contactId?: string) => void;
  placeholder?: string;
  error?: string;
}

export function ContractorLookupField({
  label = 'Contractor / Vendor',
  value,
  onChange,
  placeholder = 'Select or enter contractor',
  error,
}: ContractorLookupFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (contact: SubcontractorContact | undefined) => {
    if (contact) {
      onChange(contact.name, contact.id);
    } else {
      onChange('', undefined);
    }
    setModalVisible(false);
  };

  return (
    <View className="mb-4">
      {label && <Text className="text-sm font-medium text-foreground mb-1">{label}</Text>}
      <Pressable
        onPress={() => setModalVisible(true)}
        className={`flex-row items-center justify-between h-12 px-3 rounded-lg border bg-card ${
          error ? 'border-destructive' : 'border-input'
        }`}
      >
        <Text
          className={`text-base ${
            value ? 'text-foreground' : 'text-muted-foreground'
          }`}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <UserPlus size={20} className="text-muted-foreground" />
      </Pressable>
      {error && <Text className="text-xs text-destructive mt-1">{error}</Text>}

      <SubcontractorPickerModal
        visible={modalVisible}
        onSelect={handleSelect}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}
