/**
 * PendingPaymentForm — modal for editing metadata of a real pending payment.
 *
 * Accessible from the PaymentDetails header (pencil icon).
 * Visible only when payment.status === 'pending' && !isSynthetic.
 *
 * Added in #196.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Payment } from '../../../domain/entities/Payment';
import { Project } from '../../../domain/entities/Project';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { ProjectPickerModal } from '../../../components/shared/ProjectPickerModal';
import DatePickerInput from '../../../components/inputs/DatePickerInput';
import { invalidations } from '../../../hooks/queryKeys';
import '../../../infrastructure/di/registerServices';

interface Props {
  visible: boolean;
  payment: Payment;
  onClose(): void;
  onSaved(): void | Promise<void>;
}

const METHODS: { value: Payment['method']; label: string }[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

function isoToDate(iso?: string | null): Date | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function dateToIso(d: Date | null): string | undefined {
  return d ? d.toISOString() : undefined;
}

export function PendingPaymentForm({ visible, payment, onClose, onSaved }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#e4e4e7' : '#18181b';
  const queryClient = useQueryClient();

  const paymentRepo = React.useMemo(
    () => container.resolve<PaymentRepository>('PaymentRepository' as any),
    [],
  );

  const [date, setDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [method, setMethod] = useState<Payment['method'] | undefined>(undefined);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-populate form when modal opens
  useEffect(() => {
    if (visible) {
      setDate(isoToDate(payment.date));
      setDueDate(isoToDate(payment.dueDate));
      setMethod(payment.method);
      setReference(payment.reference ?? '');
      setNotes(payment.notes ?? '');
      setProjectId(payment.projectId);
      // projectName is loaded by the parent — we'll show projectId until user interacts
      setProjectName(undefined);
    }
  }, [visible, payment]);

  const handleSelectProject = useCallback((selected: Project | undefined) => {
    setProjectId(selected?.id);
    setProjectName(selected?.name);
    setProjectPickerVisible(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const oldProjectId = payment.projectId;
      const newProjectId = projectId;

      const updated: Payment = {
        ...payment,
        date: dateToIso(date) ?? payment.date,
        dueDate: dateToIso(dueDate) ?? payment.dueDate,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        projectId: newProjectId,
      };

      await paymentRepo.update(updated);

      await Promise.all(
        invalidations.paymentProjectAssigned({
          oldProjectId,
          newProjectId,
          isInvoice: false,
        }).map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );

      await onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const displayProjectName =
    projectName ?? (projectId ? `Project (${projectId.slice(0, 8)}…)` : 'Unassigned');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-background">
          {/* Header */}
          <View className="px-4 pt-4 pb-3 border-b border-border flex-row items-center justify-between">
            <Text className="text-xl font-bold text-foreground">Edit Payment</Text>
            <TouchableOpacity
              testID="pending-form-close-btn"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            {/* Date */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-1">Date</Text>
              <DatePickerInput
                label="Payment date"
                value={date}
                onChange={setDate}
              />
            </View>

            {/* Due Date */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-1">Due Date</Text>
              <DatePickerInput
                label="Due date"
                value={dueDate}
                onChange={setDueDate}
              />
            </View>

            {/* Method */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">Payment Method</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {METHODS.map((m) => (
                    <TouchableOpacity
                      key={m.value}
                      testID={`method-chip-${m.value}`}
                      onPress={() => setMethod(method === m.value ? undefined : m.value)}
                      className={`px-4 py-2 rounded-full border ${
                        method === m.value
                          ? 'bg-primary border-primary'
                          : 'bg-transparent border-border'
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          method === m.value ? 'text-primary-foreground' : 'text-foreground'
                        }`}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Reference */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-1">Reference</Text>
              <TextInput
                testID="reference-input"
                className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                value={reference}
                onChangeText={setReference}
                placeholder="Invoice reference"
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              />
            </View>

            {/* Notes */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-1">Notes</Text>
              <TextInput
                testID="notes-input"
                className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Project */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-1">Project</Text>
              <TouchableOpacity
                testID="form-project-row"
                onPress={() => setProjectPickerVisible(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium ${
                    projectId ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {displayProjectName}
                </Text>
                <Text className="text-xs text-muted-foreground ml-2">Change →</Text>
              </TouchableOpacity>
            </View>

            {/* Save */}
            <TouchableOpacity
              testID="save-btn"
              onPress={handleSave}
              disabled={saving}
              className="bg-primary rounded-xl py-4 items-center mb-8"
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-primary-foreground font-bold text-base">Save Changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Project picker nested inside this modal */}
      <ProjectPickerModal
        visible={projectPickerVisible}
        currentProjectId={projectId}
        onSelect={handleSelectProject}
        onClose={() => setProjectPickerVisible(false)}
      />
    </Modal>
  );
}
