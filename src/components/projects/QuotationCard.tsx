/**
 * QuotationCard
 *
 * Displays a single Quotation in the project-level Quotes timeline.
 *
 * Shows:
 *   - Reference number (e.g. "QT-2026-001")
 *   - Vendor name
 *   - Total (AUD formatted)
 *   - Status badge (draft | sent | accepted | declined)
 *   - Expiry date (when present)
 *
 * Quick actions (visible when status === 'sent'):
 *   - Accept (green)
 *   - Reject (red)
 *
 * Secondary actions (always visible):
 *   - Open (navigates to QuotationDetail)
 *   - Attach Document
 *
 * Status badge colours match those used in TaskQuotationSection for consistency.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { FileText, Check, X, ExternalLink, Paperclip } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { Quotation } from '../../domain/entities/Quotation';

cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Check, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ExternalLink, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Paperclip, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotationCardProps {
  quotation: Quotation;
  onOpen?: (quotation: Quotation) => void;
  onAccept?: (quotation: Quotation) => Promise<void>;
  onReject?: (quotation: Quotation) => Promise<void>;
  onAttachDocument?: (quotation: Quotation) => void;
  testID?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StatusConfig = { label: string; bgClass: string; textClass: string };

const STATUS_CONFIG: Record<Quotation['status'], StatusConfig> = {
  draft:    { label: 'Draft',    bgClass: 'bg-muted',       textClass: 'text-muted-foreground' },
  sent:     { label: 'Pending',  bgClass: 'bg-blue-100',    textClass: 'text-blue-700' },
  accepted: { label: 'Accepted', bgClass: 'bg-green-100',   textClass: 'text-green-700' },
  declined: { label: 'Declined', bgClass: 'bg-red-100',     textClass: 'text-red-600' },
};

function formatCurrency(amount: number | undefined, currency = 'AUD'): string {
  if (amount == null) return '—';
  return `${currency} ${amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuotationCard({
  quotation,
  onOpen,
  onAccept,
  onReject,
  onAttachDocument,
  testID,
}: QuotationCardProps) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const statusCfg = STATUS_CONFIG[quotation.status] ?? STATUS_CONFIG.draft;
  const isPending = quotation.status === 'sent';

  const handleAccept = async () => {
    if (!onAccept || accepting || rejecting) return;
    Alert.alert(
      'Accept Quotation',
      `Accept "${quotation.reference}" from ${quotation.vendorName ?? 'Unknown Vendor'}? An invoice will be created automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            try {
              setAccepting(true);
              await onAccept(quotation);
            } catch {
              Alert.alert('Error', 'Could not accept the quotation. Please try again.');
            } finally {
              setAccepting(false);
            }
          },
        },
      ],
    );
  };

  const handleReject = async () => {
    if (!onReject || accepting || rejecting) return;
    Alert.alert(
      'Reject Quotation',
      `Reject "${quotation.reference}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setRejecting(true);
              await onReject(quotation);
            } catch {
              Alert.alert('Error', 'Could not reject the quotation. Please try again.');
            } finally {
              setRejecting(false);
            }
          },
        },
      ],
    );
  };

  const busy = accepting || rejecting;

  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden mb-3"
      testID={testID}
    >
      {/* ── Main body ─────────────────────────────────────────────────── */}
      <Pressable
        className="p-4 active:opacity-80"
        onPress={() => onOpen?.(quotation)}
        testID={testID ? `${testID}-open` : undefined}
      >
        {/* Row 1: icon + reference + status */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center gap-3 flex-1 mr-3">
            <View className="w-9 h-9 bg-primary/10 rounded-full items-center justify-center flex-shrink-0">
              <FileText className="text-primary" size={16} />
            </View>
            <View className="flex-1">
              <Text
                className="text-sm font-bold text-foreground"
                testID={testID ? `${testID}-reference` : undefined}
                numberOfLines={1}
              >
                {quotation.reference}
              </Text>
              {quotation.vendorName ? (
                <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                  {quotation.vendorName}
                </Text>
              ) : null}
            </View>
          </View>

          <View className={`px-2.5 py-1 rounded-full flex-shrink-0 ${statusCfg.bgClass}`}>
            <Text
              className={`text-[11px] font-semibold ${statusCfg.textClass}`}
              testID={testID ? `${testID}-status` : undefined}
            >
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Row 2: total + expiry */}
        <View className="flex-row items-center justify-between">
          <Text
            className="text-base font-bold text-foreground"
            testID={testID ? `${testID}-total` : undefined}
          >
            {formatCurrency(quotation.total, quotation.currency)}
          </Text>

          {quotation.expiryDate ? (
            <Text className="text-xs text-muted-foreground">
              Expires {formatDate(quotation.expiryDate)}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* ── Action bar ────────────────────────────────────────────────── */}
      <View className="flex-row border-t border-border">
        {/* Accept — only when pending */}
        {isPending && onAccept ? (
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 border-r border-border active:bg-green-50"
            onPress={handleAccept}
            disabled={busy}
            testID={testID ? `${testID}-accept` : undefined}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#16a34a" />
            ) : (
              <Check className="text-green-600" size={14} />
            )}
            <Text className="text-xs font-semibold text-green-600">Accept</Text>
          </Pressable>
        ) : null}

        {/* Reject — only when pending */}
        {isPending && onReject ? (
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 border-r border-border active:bg-red-50"
            onPress={handleReject}
            disabled={busy}
            testID={testID ? `${testID}-reject` : undefined}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <X className="text-red-600" size={14} />
            )}
            <Text className="text-xs font-semibold text-red-600">Reject</Text>
          </Pressable>
        ) : null}

        {/* Attach document */}
        {onAttachDocument ? (
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 border-r border-border active:bg-muted"
            onPress={() => onAttachDocument(quotation)}
            testID={testID ? `${testID}-attach` : undefined}
          >
            <Paperclip className="text-muted-foreground" size={14} />
            <Text className="text-xs font-semibold text-muted-foreground">Attach</Text>
          </Pressable>
        ) : null}

        {/* Open / details */}
        {onOpen ? (
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 active:bg-muted"
            onPress={() => onOpen(quotation)}
            testID={testID ? `${testID}-details` : undefined}
          >
            <ExternalLink className="text-muted-foreground" size={14} />
            <Text className="text-xs font-semibold text-muted-foreground">Open</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
