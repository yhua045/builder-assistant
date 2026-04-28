/**
 * TimelinePaymentCard
 *
 * Payment card purpose-built for the project detail timeline.
 * Shows: contractor name, category/stage label, amount, due status,
 * and a quick-action row (View, Record Payment, Attach Document).
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  DollarSign,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { Payment } from '../../../domain/entities/Payment';
import { getDueStatus } from '../../../utils/getDueStatus';

cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });
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
  /** Navigates to PaymentDetails for editing */
  onEdit: () => void;
  /** When provided, shows the Review Payment button */
  onReviewPayment?: () => void;
  testID?: string;
}

export function TimelinePaymentCard({
  payment,
  onEdit,
  onReviewPayment,
  testID,
}: TimelinePaymentCardProps) {
  const label = categoryLabel(payment.paymentCategory, payment.stageLabel);
  const isSettled = payment.status === 'settled';

  // Date footer helpers
  const dueDateText = !isSettled && payment.dueDate
    ? getDueStatus(payment.dueDate).text
    : null;
  const paidAt = (payment as any).paidAt as string | undefined;
  const paidDateText = isSettled && paidAt
    ? `Paid on ${new Date(paidAt).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
      })}`
    : isSettled ? 'Paid' : null;

  return (
    <View
      className="ml-4 mb-3 bg-card border border-border rounded-xl overflow-hidden"
      testID={testID}
      accessibilityLabel={`Payment card: ${payment.contractorName ?? 'Unknown'}, ${formatCurrency(payment.amount)}`}
    >
      <View className="px-4 pt-3 pb-2">
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

        {/* Date footer */}
        {paidDateText ? (
          <Text
            testID="payment-paid-date"
            className="text-xs font-medium text-green-700 mt-2"
          >
            {paidDateText}
          </Text>
        ) : dueDateText ? (
          <Text
            testID="payment-due-date"
            className="text-xs text-muted-foreground mt-2"
          >
            {dueDateText}
          </Text>
        ) : null}

        {/* Action row — shown only for non-settled payments */}
        {!isSettled ? (
          <View className="pt-2 mt-2 border-t border-border/50 flex-row gap-2">
            <Pressable
              testID={testID ? `${testID}-edit` : 'payment-action-edit'}
              onPress={onEdit}
              className="flex-row items-center gap-1 px-2.5 py-1.5 bg-muted rounded-lg self-start"
            >
              <Text className="text-xs font-medium text-foreground">Edit</Text>
            </Pressable>
            {onReviewPayment ? (
              <Pressable
                testID={testID ? `${testID}-review-payment` : 'payment-action-review-payment'}
                onPress={onReviewPayment}
                className="flex-row items-center gap-1 px-2.5 py-1.5 bg-muted rounded-lg self-start"
              >
                <DollarSign size={12} className="text-muted-foreground" />
                <Text className="text-xs font-medium text-foreground">Review Payment</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
