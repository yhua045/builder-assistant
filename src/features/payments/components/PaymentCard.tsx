import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Payment } from '../../../domain/entities/Payment';
import { getDueStatus } from '../../../utils/getDueStatus';

export type PaymentCardPayment = Payment & {
  projectName?: string;
  /** ISO date string; shown as "Paid on DD Mon YYYY" when status === 'settled' */
  paidDate?: string;
};

interface PaymentCardProps {
  payment: PaymentCardPayment;
  onPress?: () => void;
  onPayNow?: (payment: PaymentCardPayment) => void;
}

const categoryLabel = (category?: string, stage?: string): string => {
  const cat = category === 'contract' ? 'Contract' : category === 'variation' ? 'Variation' : null;
  if (!cat) return stage ?? '';
  return stage ? `${cat}: ${stage}` : cat;
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(amount);

export default function PaymentCard({ payment, onPress, onPayNow }: PaymentCardProps) {
  const isDeadInvoice =
    payment.invoiceStatus === 'cancelled' || payment.invoiceStatus === 'draft';

  const dueStatus = !isDeadInvoice && payment.dueDate ? getDueStatus(payment.dueDate) : null;
  const label = categoryLabel(payment.paymentCategory, payment.stageLabel);

  const footerBg =
    dueStatus?.style === 'overdue'
      ? 'bg-red-50'
      : dueStatus?.style === 'due-soon'
      ? 'bg-amber-50'
      : 'bg-green-50';

  const footerText =
    dueStatus?.style === 'overdue'
      ? 'text-red-600'
      : dueStatus?.style === 'due-soon'
      ? 'text-amber-600'
      : 'text-green-600';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="bg-card border border-border rounded-xl overflow-hidden mb-3"
    >
      {/* Project header */}
      {payment.projectName ? (
        <View className="px-4 pt-3 pb-1">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {payment.projectName}
          </Text>
        </View>
      ) : null}

      {/* Body */}
      <View className="px-4 py-3 flex-row items-start justify-between">
        <View className="flex-1 mr-4">
          <Text className="text-base font-bold text-foreground mb-1">
            {payment.contractorName ?? payment.contactId ?? 'Unknown Contractor'}
          </Text>
          {label ? (
            <View className="bg-muted rounded px-2 py-0.5 self-start">
              <Text className="text-xs text-muted-foreground">{label}</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-lg font-bold text-foreground">{formatCurrency(payment.amount)}</Text>
      </View>

      {/* Footer — settled, dead-invoice banner, or due status */}
      {payment.status === 'settled' ? (
        <View className="px-4 py-2 min-h-[36px] bg-green-50 flex-row items-center">
          <Text className="text-xs font-semibold text-green-600">
            {payment.paidDate
              ? `Paid on ${new Date(payment.paidDate).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`
              : 'Paid'}
          </Text>
        </View>
      ) : isDeadInvoice ? (
        <View className="px-4 py-2 min-h-[36px] bg-red-50 flex-row items-center">
          <Text className="text-xs font-semibold text-gray-500">
            {payment.invoiceStatus === 'cancelled'
              ? 'Invoice cancelled'
              : 'Invoice draft — not yet issued'}
          </Text>
        </View>
      ) : dueStatus ? (
        <View className={`px-4 py-2 min-h-[36px] flex-row items-center justify-between ${footerBg}`}>
          <Text className={`text-xs font-semibold ${footerText}`}>
            {dueStatus.text}
          </Text>
          {payment.status === 'pending' && onPayNow ? (
            <TouchableOpacity
              testID="pay-now-btn"
              onPress={() => onPayNow(payment)}
              className="bg-white/20 rounded px-3 py-1"
              activeOpacity={0.8}
            >
              <Text className={`text-xs font-bold ${footerText}`}>
                Pay Now
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
