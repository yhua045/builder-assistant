import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Payment } from '../../domain/entities/Payment';
import { getDueStatus } from '../../utils/getDueStatus';

export type PaymentCardPayment = Payment & { projectName?: string };

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
  const dueStatus = payment.dueDate ? getDueStatus(payment.dueDate) : null;
  const label = categoryLabel(payment.paymentCategory, payment.stageLabel);

  const footerBg =
    dueStatus?.style === 'overdue'
      ? styles.footerOverdue
      : dueStatus?.style === 'due-soon'
      ? styles.footerDueSoon
      : styles.footerOnTime;

  const footerText =
    dueStatus?.style === 'overdue'
      ? styles.footerTextOverdue
      : dueStatus?.style === 'due-soon'
      ? styles.footerTextDueSoon
      : styles.footerTextOnTime;

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

      {/* Footer — due status */}
      {dueStatus ? (
        <View style={[styles.footer, footerBg]} className="px-4 py-2 flex-row items-center justify-between">
          <Text style={footerText} className="text-xs font-semibold">
            {dueStatus.text}
          </Text>
          {payment.status === 'pending' && onPayNow ? (
            <TouchableOpacity
              onPress={() => onPayNow(payment)}
              className="bg-white/20 rounded px-3 py-1"
              activeOpacity={0.8}
            >
              <Text style={footerText} className="text-xs font-bold">
                Pay Now
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  footer: { minHeight: 36 },
  footerOverdue: { backgroundColor: '#fef2f2' },
  footerDueSoon: { backgroundColor: '#fffbeb' },
  footerOnTime: { backgroundColor: '#f0fdf4' },
  footerTextOverdue: { color: '#dc2626' },
  footerTextDueSoon: { color: '#d97706' },
  footerTextOnTime: { color: '#16a34a' },
});
