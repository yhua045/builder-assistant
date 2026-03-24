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
        style={styles.flex}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Contractor</Text>
            <TouchableOpacity testID="quick-add-cancel-btn" onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Name field */}
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              testID="quick-add-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Contractor name"
              style={[styles.input, nameError ? styles.inputError : null]}
              autoFocus
            />
            {nameError ? <Text testID="quick-add-name-error" style={styles.error}>{nameError}</Text> : null}
          </View>

          {/* Trade field */}
          <View style={styles.field}>
            <Text style={styles.label}>Trade</Text>
            <TextInput
              testID="quick-add-trade-input"
              value={trade}
              onChangeText={setTrade}
              placeholder="e.g. Electrical, Plumbing"
              style={styles.input}
            />
          </View>

          {/* License Number field */}
          <View style={styles.field}>
            <Text style={styles.label}>License Number</Text>
            <TextInput
              testID="quick-add-license-input"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              placeholder="e.g. VBA-12345"
              style={[styles.input, licenseError ? styles.inputError : null]}
              autoCapitalize="characters"
            />
            {licenseError ? <Text testID="quick-add-license-error" style={styles.error}>{licenseError}</Text> : null}
          </View>

          {/* Phone field */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              testID="quick-add-phone-input"
              value={phone}
              onChangeText={setPhone}
              placeholder="0400 000 000"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          {/* Lookup by license button — feature flagged */}
          {FeatureFlags.externalLookup && onLookupByLicense && (
            <View style={styles.field}>
              <TouchableOpacity
                testID="quick-add-lookup-btn"
                onPress={handleLookup}
                disabled={lookupLoading}
                style={styles.lookupBtn}
              >
                {lookupLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.lookupBtnText}>Lookup by license</Text>
                )}
              </TouchableOpacity>
              {lookupError ? (
                <Text testID="quick-add-lookup-error" style={styles.error}>{lookupError}</Text>
              ) : null}
            </View>
          )}

          {/* Save button */}
          <TouchableOpacity
            testID="quick-add-save-btn"
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 18, fontWeight: '600' },
  cancelBtn: { padding: 4 },
  cancelText: { color: '#007AFF', fontSize: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  inputError: { borderColor: '#EF4444' },
  error: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  lookupBtn: { backgroundColor: '#6B7280', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  lookupBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  saveBtn: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
