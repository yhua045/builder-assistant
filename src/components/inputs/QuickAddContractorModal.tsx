import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Contact } from '../../domain/entities/Contact';
import { FeatureFlags } from '../../infrastructure/config/featureFlags';

export interface QuickAddContractorModalProps {
  visible: boolean;
  initialName?: string;
  onSave: (contact: Contact) => void;
  onCancel: () => void;
  /** Injected to allow testing without QueryClient */
  onQuickAdd: (input: { name: string; trade?: string; licenseNumber?: string; phone?: string }) => Promise<Contact>;
  /** Injected lookup fn — only called when FeatureFlags.externalLookup is true */
  onLookupByLicense?: (query: string) => Promise<Array<{ licenseNumber: string; name: string; trade?: string; phone?: string; source: string }>>;
}

export function QuickAddContractorModal({
  visible,
  initialName = '',
  onSave,
  onCancel,
  onQuickAdd,
  onLookupByLicense,
}: QuickAddContractorModalProps) {
  const [name, setName] = useState(initialName);
  const [trade, setTrade] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Reset form when modal opens with new initialName
  React.useEffect(() => {
    if (visible) {
      setName(initialName);
      setTrade('');
      setLicenseNumber('');
      setPhone('');
      setNameError('');
      setLicenseError('');
      setLookupError('');
    }
  }, [visible, initialName]);

  const handleSave = async () => {
    setNameError('');
    setLicenseError('');

    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    setSaving(true);
    try {
      const contact = await onQuickAdd({
        name: name.trim(),
        trade: trade.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onSave(contact);
    } catch (err: any) {
      if (err?.message?.includes('licenseNumber')) {
        setLicenseError(err.message);
      } else if (err?.message?.includes('name')) {
        setNameError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLookup = async () => {
    if (!onLookupByLicense) return;
    const query = licenseNumber.trim() || name.trim();
    if (!query) return;

    setLookupError('');
    setLookupLoading(true);
    try {
      const results = await onLookupByLicense(query);
      if (results.length > 0) {
        const first = results[0];
        setName(first.name);
        setTrade(first.trade ?? trade);
        setPhone(first.phone ?? phone);
        setLicenseNumber(first.licenseNumber);
      } else {
        setLookupError('No results found. Please enter details manually.');
      }
    } catch (_err) {
      setLookupError('Lookup unavailable. Please enter details manually.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onCancel}
      testID="quick-add-contractor-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-white p-4">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-zinc-900">Add Contractor</Text>
            <TouchableOpacity testID="quick-add-cancel-btn" onPress={onCancel} className="p-2">
              <Text className="text-base text-blue-600">Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Name field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-zinc-700 mb-2">Name *</Text>
            <TextInput
              testID="quick-add-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Contractor name"
              className={`h-11 border rounded-lg px-3 text-base ${
                nameError ? 'border-red-500' : 'border-zinc-300'
              }`}
              autoFocus
            />
            {nameError ? <Text testID="quick-add-name-error" className="text-sm text-red-500 mt-1">{nameError}</Text> : null}
          </View>

          {/* Trade field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-zinc-700 mb-2">Trade</Text>
            <TextInput
              testID="quick-add-trade-input"
              value={trade}
              onChangeText={setTrade}
              placeholder="e.g. Electrical, Plumbing"
              className="h-11 border border-zinc-300 rounded-lg px-3 text-base"
            />
          </View>

          {/* License Number field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-zinc-700 mb-2">License Number</Text>
            <TextInput
              testID="quick-add-license-input"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              placeholder="e.g. VBA-12345"
              className={`h-11 border rounded-lg px-3 text-base ${
                licenseError ? 'border-red-500' : 'border-zinc-300'
              }`}
              autoCapitalize="characters"
            />
            {licenseError ? <Text testID="quick-add-license-error" className="text-sm text-red-500 mt-1">{licenseError}</Text> : null}
          </View>

          {/* Phone field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-zinc-700 mb-2">Phone</Text>
            <TextInput
              testID="quick-add-phone-input"
              value={phone}
              onChangeText={setPhone}
              placeholder="0400 000 000"
              keyboardType="phone-pad"
              className="h-11 border border-zinc-300 rounded-lg px-3 text-base"
            />
          </View>

          {/* Lookup by license button — feature flagged */}
          {FeatureFlags.externalLookup && onLookupByLicense && (
            <View className="mb-4">
              <TouchableOpacity
                testID="quick-add-lookup-btn"
                onPress={handleLookup}
                disabled={lookupLoading}
                className="bg-blue-600 rounded-lg h-11 justify-center items-center"
              >
                {lookupLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">Lookup by license</Text>
                )}
              </TouchableOpacity>
              {lookupError ? (
                <Text testID="quick-add-lookup-error" className="text-sm text-red-500 mt-1">{lookupError}</Text>
              ) : null}
            </View>
          )}

          {/* Save button */}
          <TouchableOpacity
            testID="quick-add-save-btn"
            onPress={handleSave}
            disabled={saving}
            className="bg-blue-600 rounded-lg py-[14px] items-center mt-2"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white text-base font-semibold">Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
