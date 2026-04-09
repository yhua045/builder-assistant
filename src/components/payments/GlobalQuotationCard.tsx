import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Quotation } from '../../domain/entities/Quotation';

interface GlobalQuotationCardProps {
  quotation: Quotation;
  projectName?: string;
  onPress?: () => void;
}

const STATUS_CONFIG: Record<
  Quotation['status'],
  { label: string; bg: string; text: string }
> = {
  draft:    { label: 'Draft',    bg: '#f4f4f5', text: '#71717a' },
  sent:     { label: 'Sent',     bg: '#eff6ff', text: '#2563eb' },
  pending_approval: { label: 'Pending', bg: '#fef3c7', text: '#d97706' },
  accepted: { label: 'Accepted', bg: '#f0fdf4', text: '#16a34a' },
  declined: { label: 'Declined', bg: '#fef2f2', text: '#dc2626' },
};

const formatCurrency = (amount: number, currency = 'AUD'): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

const formatDate = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function GlobalQuotationCard({
  quotation,
  projectName,
  onPress,
}: GlobalQuotationCardProps) {
  const statusCfg = STATUS_CONFIG[quotation.status] ?? STATUS_CONFIG.draft;
  const expiryFormatted = formatDate(quotation.expiryDate);

  return (
    <TouchableOpacity
      testID="global-quotation-card"
      onPress={onPress}
      activeOpacity={0.75}
      className="bg-card border border-border rounded-xl overflow-hidden mb-3"
    >
      {/* Optional project header */}
      {projectName ? (
        <View className="px-4 pt-3 pb-1">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {projectName}
          </Text>
        </View>
      ) : null}

      {/* Body – vendor name + amount */}
      <View className="px-4 py-3 flex-row items-start justify-between">
        <View className="flex-1 mr-4">
          <Text className="text-base font-bold text-foreground mb-1">
            {quotation.vendorName ?? 'Unknown Vendor'}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {quotation.reference}
          </Text>
        </View>
        <Text className="text-lg font-bold text-foreground">
          {formatCurrency(quotation.total, quotation.currency)}
        </Text>
      </View>

      {/* Footer – status badge + expiry */}
      <View style={styles.footer} className="px-4 py-2 flex-row items-center justify-between">
        <View
          style={[styles.badge, { backgroundColor: statusCfg.bg }]}
        >
          <Text style={[styles.badgeText, { color: statusCfg.text }]}>
            {statusCfg.label}
          </Text>
        </View>
        {expiryFormatted ? (
          <Text className="text-xs text-muted-foreground">
            {`Exp: ${expiryFormatted}`}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  footer: { minHeight: 36, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e4e4e7' },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
