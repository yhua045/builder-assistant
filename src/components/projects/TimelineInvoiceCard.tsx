/**
 * TimelineInvoiceCard
 *
 * Invoice card purpose-built for the project detail payments timeline.
 * Visually distinct from TimelinePaymentCard via an amber left-border accent.
 * Shows: issuer name, invoice reference, total, invoice status, payment status,
 * and a quick-action row (View, Mark Paid, Attach Document).
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ExternalLink, Paperclip, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { Invoice } from '../../domain/entities/Invoice';

cssInterop(ExternalLink, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Paperclip, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(amount);

// ─── Status chips ─────────────────────────────────────────────────────────────

function InvoiceStatusChip({ status }: { status: Invoice['status'] }) {
  const config: Record<Invoice['status'], { label: string; bg: string; text: string }> = {
    draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600' },
    issued: { label: 'Issued', bg: 'bg-blue-50', text: 'text-blue-700' },
    paid: { label: 'Paid', bg: 'bg-green-50', text: 'text-green-700' },
    overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700' },
    cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-500' },
  };
  const { label, bg, text } = config[status] ?? config.draft;
  return (
    <View className={`${bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`text-[10px] font-semibold ${text}`}>{label}</Text>
    </View>
  );
}

function PaymentStatusChip({ status }: { status: Invoice['paymentStatus'] }) {
  const config: Record<Invoice['paymentStatus'], { label: string; bg: string; text: string }> = {
    unpaid: { label: 'Unpaid', bg: 'bg-orange-50', text: 'text-orange-700' },
    partial: { label: 'Partial', bg: 'bg-amber-50', text: 'text-amber-700' },
    paid: { label: 'Paid', bg: 'bg-green-50', text: 'text-green-700' },
    failed: { label: 'Failed', bg: 'bg-red-50', text: 'text-red-700' },
  };
  const { label, bg, text } = config[status] ?? config.unpaid;
  return (
    <View className={`${bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`text-[10px] font-semibold ${text}`}>{label}</Text>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TimelineInvoiceCardProps {
  invoice: Invoice;
  onView: (invoice: Invoice) => void;
  onMarkAsPaid: (invoice: Invoice) => void;
  onAttachDocument: (invoice: Invoice) => void;
  testID?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelineInvoiceCard({
  invoice,
  onView,
  onMarkAsPaid,
  onAttachDocument,
  testID,
}: TimelineInvoiceCardProps) {
  const issuerLabel =
    invoice.issuerName ?? invoice.vendor ?? 'Unknown Vendor';
  const referenceLabel =
    invoice.externalReference ?? invoice.invoiceNumber ?? '';

  return (
    <View
      testID={testID ?? `invoice-card-${invoice.id}`}
      className="ml-4 mb-3 bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Amber left-border accent */}
      <View className="flex-row">
        <View className="w-[3px] bg-amber-400" />
        <View className="flex-1 p-3">
          {/* Header row: issuer name + total */}
          <View className="flex-row items-start justify-between mb-1">
            <View className="flex-row items-center gap-1.5 flex-1 mr-2">
              <FileText size={13} className="text-amber-500" />
              <Text
                className="text-sm font-semibold text-foreground flex-1"
                numberOfLines={1}
              >
                {issuerLabel}
              </Text>
            </View>
            <Text className="text-sm font-bold text-foreground">
              {formatCurrency(invoice.total)}
            </Text>
          </View>

          {/* Sub-row: reference */}
          {referenceLabel ? (
            <Text className="text-xs text-muted-foreground mb-2">{referenceLabel}</Text>
          ) : null}

          {/* Status chips row */}
          <View className="flex-row gap-1.5 mb-3">
            <InvoiceStatusChip status={invoice.status} />
            <PaymentStatusChip status={invoice.paymentStatus} />
          </View>

          {/* Quick-action row */}
          <View className="flex-row gap-2 pt-2 border-t border-border/50">
            <Pressable
              testID="invoice-action-view"
              onPress={() => onView(invoice)}
              className="flex-row items-center gap-1 px-2.5 py-1.5 bg-muted rounded-lg"
            >
              <ExternalLink size={12} className="text-muted-foreground" />
              <Text className="text-xs font-medium text-foreground">View</Text>
            </Pressable>

            <Pressable
              testID="invoice-action-mark-paid"
              onPress={() => onMarkAsPaid(invoice)}
              className="flex-row items-center gap-1 px-2.5 py-1.5 bg-muted rounded-lg"
            >
              <CheckCircle size={12} className="text-muted-foreground" />
              <Text className="text-xs font-medium text-foreground">Mark Paid</Text>
            </Pressable>

            <Pressable
              testID="invoice-action-attach"
              onPress={() => onAttachDocument(invoice)}
              className="flex-row items-center gap-1 px-2.5 py-1.5 bg-muted rounded-lg"
            >
              <Paperclip size={12} className="text-muted-foreground" />
              <Text className="text-xs font-medium text-foreground">Attach</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
