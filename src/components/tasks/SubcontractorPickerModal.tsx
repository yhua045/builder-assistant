import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { X, HardHat, UserPlus } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import useContacts from '../../hooks/useContacts';
import { QuickAddContractorModal } from '../inputs/QuickAddContractorModal';
import { useQuickLookup } from '../../hooks/useQuickLookup';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(HardHat, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(UserPlus, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface SubcontractorContact {
  id: string;
  name: string;
  trade?: string;
  phone?: string;
  email?: string;
}

interface Props {
  visible: boolean;
  selectedId?: string;
  onSelect(contact: SubcontractorContact | undefined): void;
  onClose(): void;
}

export function SubcontractorPickerModal({ visible, selectedId, onSelect, onClose }: Props) {
  const { contacts } = useContacts();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SubcontractorContact[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { search } = useContacts();
  const { quickAdd } = useQuickLookup();

  const refresh = useCallback(
    async (q: string) => {
      const raw = await search(q);
      setResults(
        (raw as any[]).map((c) => ({
          id: c.id,
          name: c.name,
          trade: c.trade ?? c.title,
          phone: c.phone,
          email: c.email,
        })),
      );
    },
    [search],
  );

  useEffect(() => {
    if (visible) {
      refresh(query);
    }
  }, [visible, query, refresh]);

  const handleSelect = (contact: SubcontractorContact) => {
    onSelect(contact);
    setQuery('');
    onClose();
  };

  const handleClear = () => {
    onSelect(undefined);
    setQuery('');
    onClose();
  };

  const renderItem = ({ item }: { item: SubcontractorContact }) => (
    <TouchableOpacity
      testID={`subcontractor-item-${item.id}`}
      onPress={() => handleSelect(item)}
      className={`flex-row items-center gap-3 px-4 py-3 border-b border-border ${
        item.id === selectedId ? 'bg-primary/10' : ''
      }`}
    >
      <HardHat size={18} className="text-muted-foreground" />
      <View className="flex-1">
        <Text className="text-foreground font-medium">{item.name}</Text>
        {item.trade ? (
          <Text className="text-xs text-muted-foreground">{item.trade}</Text>
        ) : null}
      </View>
      {item.id === selectedId && (
        <View className="w-2 h-2 rounded-full bg-primary" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">Select Subcontractor</Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => setShowQuickAdd(true)} className="p-1">
              <UserPlus size={20} className="text-primary" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X size={20} className="text-muted-foreground" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View className="px-4 py-3 border-b border-border">
          <TextInput
            className="h-10 rounded-lg border border-input bg-card px-3 text-foreground"
            placeholder="Search contacts..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* Clear selection */}
        {selectedId && (
          <TouchableOpacity
            onPress={handleClear}
            className="px-4 py-3 border-b border-border flex-row items-center gap-2"
          >
            <X size={16} className="text-destructive" />
            <Text className="text-destructive text-sm">Clear subcontractor</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="px-4 py-8 items-center">
              <Text className="text-muted-foreground text-sm">No contacts found</Text>
              <TouchableOpacity onPress={() => setShowQuickAdd(true)} className="mt-4 p-2 bg-primary/10 rounded-lg">
                <Text className="text-primary font-medium">Add New Contractor</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <QuickAddContractorModal
          visible={showQuickAdd}
          initialName={query}
          onSave={(contact) => {
            setShowQuickAdd(false);
            // Delay the parent close on iOS to avoid nested modal dismiss issues freezing the underlying UI
            setTimeout(() => {
              handleSelect({
                id: contact.id,
                name: contact.name,
                trade: contact.trade,
                phone: contact.phone,
                email: contact.email,
              });
            }, 300);
          }}
          onCancel={() => setShowQuickAdd(false)}
          onQuickAdd={quickAdd}
        />
      </View>
    </Modal>
  );
}
