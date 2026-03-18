/**
 * TimelineQuotationCard
 *
 * Quotation card for the project detail timeline.
 * Shows: vendor name, reference, total, status chip.
 * Tapping navigates to the linked task's detail.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { Quotation } from '../../domain/entities/Quotation';

cssInterop(ExternalLink, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(XCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(amount);
};

interface StatusStyle {
  container: string;
  text: string;
  label: string;
  iconColor: string;
}

function getStatusStyle(status: Quotation['status']): StatusStyle {
  switch (status) {
    case 'accepted':
      return { container: 'bg-green-50', text: 'text-green-700', label: 'Accepted', iconColor: '#15803d' };
    case 'declined':
      return { container: 'bg-red-50', text: 'text-red-700', label: 'Declined', iconColor: '#b91c1c' };
    case 'sent':
      return { container: 'bg-blue-50', text: 'text-blue-700', label: 'Sent', iconColor: '#1d4ed8' };
    case 'draft':
    default:
      return { container: 'bg-yellow-50', text: 'text-yellow-700', label: 'Draft', iconColor: '#a16207' };
  }
}

function StatusIcon({ status, color, size = 11 }: { status: Quotation['status']; color: string; size?: number }) {
  switch (status) {
    case 'accepted': return <CheckCircle size={size} color={color} />;
    case 'declined': return <XCircle size={size} color={color} />;
    default:         return <Clock size={size} color={color} />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TimelineQuotationCardProps {
  quotation: Quotation;
  /** Navigate to TaskDetails for the task linked to this quotation. */
  onViewTask: (quotation: Quotation) => void;
  testID?: string;
}

export function TimelineQuotationCard({
  quotation,
  onViewTask,
  testID,
}: TimelineQuotationCardProps) {
  const style = getStatusStyle(quotation.status);

  return (
    <Pressable
      onPress={() => onViewTask(quotation)}
      className="ml-4 mb-3 bg-card border border-border rounded-xl overflow-hidden active:opacity-70"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Quotation ${quotation.reference} from ${quotation.vendorName ?? 'Unknown'}, ${style.label}`}
    >
      {/* Body */}
      <View className="px-4 pt-3 pb-2 flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {quotation.vendorName ?? 'Unknown Vendor'}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">{quotation.reference}</Text>
        </View>
        <Text className="text-base font-bold text-foreground">
          {formatCurrency(quotation.total)}
        </Text>
      </View>

      {/* Footer row: status + view action */}
      <View className="flex-row items-center justify-between px-4 pb-3">
        <View className={`flex-row items-center gap-1 ${style.container} px-2 py-0.5 rounded-full`}>
          <StatusIcon status={quotation.status} color={style.iconColor} />
          <Text className={`text-[10px] font-semibold ${style.text}`}>{style.label}</Text>
        </View>

        <View className="flex-row items-center gap-1">
          <FileText size={12} color="#6b7280" />
          <Text className="text-xs text-muted-foreground">View task</Text>
          <ExternalLink size={11} color="#6b7280" />
        </View>
      </View>
    </Pressable>
  );
}
