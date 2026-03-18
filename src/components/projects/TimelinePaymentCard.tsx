/**
 * TimelinePaymentCard
 *
 * Payment card purpose-built for the project detail timeline.
 * Shows: contractor name, category/stage label, amount, due status,
 * and a quick-action row (View, Record Payment, Attach Document).
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import {
  ExternalLink,
  DollarSign,
  Paperclip,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { Payment } from '../../domain/entities/Payment';
import { getDueStatus } from '../../utils/getDueStatus';

cssInterop(ExternalLink, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Paperclip, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(amount);

const categoryLabel = (category?: string, stage?: string): string => {
  const cat =
    category === 'contract' ? 'Contract' : category === 'variation' ? 'Variation' : null;
  if (!cat) return stage ?? '';
  return stage ? `${cat}: ${stage}` : cat;
};

function StatusChip({ payment }: { payment: Payment }) {
  if (payment.status === 'settled') {
    return (
      <View className="flex-row items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full self-start">
        <CheckCircle size={10} color="#15803d" />
        <Text className="text-[10px] font-semibold text-green-700">Paid</Text>
      </View>
    );
  }

  const isDeadInvoice =
    payment.invoiceStatus === 'cancelled' || payment.invoiceStatus === 'draft';

  if (isDeadInvoice) {
    return (
      <View className="bg-gray-100 px-2 py-0.5 rounded-full self-start">
        <Text className="text-[10px] font-semibold text-gray-500">
          {payment.invoiceStatus === 'cancelled' ? 'Cancelled' : 'Draft'}
        </Text>
      </View>
    );
  }

  const dueStatus = payment.dueDate ? getDueStatus(payment.dueDate) : null;
  if (!dueStatus) return null;

  const chipClass =
    dueStatus.style === 'overdue'
      ? 'bg-red-50'
      : dueStatus.style === 'due-soon'
      ? 'bg-yellow-50'
      : 'bg-blue-50';

  const textClass =
    dueStatus.style === 'overdue'
      ? 'text-red-700'
      : dueStatus.style === 'due-soon'
      ? 'text-yellow-700'
      : 'text-blue-700';

  const IconComp =
    dueStatus.style === 'overdue'
      ? AlertCircle
      : Clock;

  const iconColor =
    dueStatus.style === 'overdue' ? '#b91c1c' : dueStatus.style === 'due-soon' ? '#a16207' : '#1d4ed8';

  return (
    <View className={`flex-row items-center gap-1 ${chipClass} px-2 py-0.5 rounded-full self-start`}>
      <IconComp size={10} color={iconColor} />
      <Text className={`text-[10px] font-semibold ${textClass}`}>{dueStatus.text}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TimelinePaymentCardProps {
  payment: Payment;
  onView: (payment: Payment) => void;
  onRecordPayment: (payment: Payment) => void;
  onAttachDocument: (payment: Payment) => void;
  testID?: string;
}

export function TimelinePaymentCard({
  payment,
  onView,
  onRecordPayment,
  onAttachDocument,
  testID,
}: TimelinePaymentCardProps) {
  const [recordingPayment, setRecordingPayment] = useState(false);

  const label = categoryLabel(payment.paymentCategory, payment.stageLabel);
  const isPending = payment.status === 'pending' || !payment.status;

  const handleRecordPayment = async () => {
    setRecordingPayment(true);
    try {
      onRecordPayment(payment);
    } finally {
      setRecordingPayment(false);
    }
  };

  return (
    <View
      className="ml-4 mb-3 bg-card border border-border rounded-xl overflow-hidden"
      testID={testID}
    >
      {/* Body */}
      <Pressable
        onPress={() => onView(payment)}
        className="px-4 pt-3 pb-2 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={`View payment: ${payment.contractorName ?? 'Unknown'}, ${formatCurrency(payment.amount)}`}
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
              {payment.contractorName ?? 'Unknown Contractor'}
            </Text>
            {label ? (
              <View className="bg-muted rounded px-2 py-0.5 self-start mt-1">
                <Text className="text-[10px] text-muted-foreground">{label}</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-base font-bold text-foreground">
            {formatCurrency(payment.amount)}
          </Text>
        </View>
        <StatusChip payment={payment} />
      </Pressable>

      {/* Quick-action row */}
      <View className="flex-row border-t border-border/50">
        <Pressable
          onPress={() => onView(payment)}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 active:bg-muted/30"
          accessibilityRole="button"
          accessibilityLabel="View payment details"
        >
          <ExternalLink size={13} color="#6b7280" />
          <Text className="text-xs text-muted-foreground font-medium">View</Text>
        </Pressable>

        {isPending ? (
          <Pressable
            onPress={handleRecordPayment}
            disabled={recordingPayment}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 border-l border-border/50 active:bg-muted/30"
            accessibilityRole="button"
            accessibilityLabel="Record payment"
            testID={testID ? `${testID}-record` : undefined}
          >
            {recordingPayment ? (
              <ActivityIndicator size={13} />
            ) : (
              <DollarSign size={13} color="#6b7280" />
            )}
            <Text className="text-xs text-muted-foreground font-medium">Pay</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => onAttachDocument(payment)}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 border-l border-border/50 active:bg-muted/30"
          accessibilityRole="button"
          accessibilityLabel="Attach document"
        >
          <Paperclip size={13} color="#6b7280" />
          <Text className="text-xs text-muted-foreground font-medium">Attach</Text>
        </Pressable>
      </View>
    </View>
  );
}
