/**
 * QuotationDetail
 *
 * Minimal project-stack screen for viewing a single quotation.
 * Pushed from ProjectDetail when the user taps "Open" on a QuotationCard.
 *
 * Shows: reference, vendor, status, dates, total, line items, and notes.
 * Edit/delete flows are out of scope for this ticket (issue-158).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, FileText, FolderOpen } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { container } from 'tsyringe';
import { Quotation } from '../../domain/entities/Quotation';
import { QuotationRepository } from '../../domain/repositories/QuotationRepository';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { useQuotations } from '../../hooks/useQuotations';
import '../../infrastructure/di/registerServices';

cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FolderOpen, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StatusConfig = { label: string; bgClass: string; textClass: string };

const STATUS_CONFIG: Record<Quotation['status'], StatusConfig> = {
  draft:            { label: 'Draft',            bgClass: 'bg-muted',        textClass: 'text-muted-foreground' },
  sent:             { label: 'Pending',           bgClass: 'bg-blue-100',     textClass: 'text-blue-700' },
  pending_approval: { label: 'Pending Approval',  bgClass: 'bg-yellow-100',   textClass: 'text-yellow-700' },
  accepted:         { label: 'Accepted',          bgClass: 'bg-green-100',    textClass: 'text-green-700' },
  declined:         { label: 'Declined',          bgClass: 'bg-red-100',      textClass: 'text-red-600' },
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuotationDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { quotationId } = route.params as { quotationId: string };

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [declining, setDeclining] = useState(false);

  const { approveQuotation, declineQuotation } = useQuotations();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const repo = container.resolve<QuotationRepository>('QuotationRepository');
      const result = await repo.getQuotation(quotationId);
      if (!result) throw new Error('Quotation not found.');
      setQuotation(result);

      // Load project name if projectId is set
      if (result.projectId) {
        try {
          const projectRepo = container.resolve<ProjectRepository>('ProjectRepository');
          const project = await projectRepo.findById(result.projectId);
          setProjectName(project?.name ?? null);
        } catch {
          // project name is optional — swallow and leave null
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotation.');
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = useCallback(() => {
    if (!quotation) return;
    const totalDisplay = formatCurrency(quotation.total, quotation.currency);
    Alert.alert(
      'Approve Quotation',
      `This will create an invoice for ${totalDisplay}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              setApproving(true);
              await approveQuotation(quotation.id);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to approve quotation');
            } finally {
              setApproving(false);
            }
          },
        },
      ],
    );
  }, [quotation, approveQuotation, load]);

  const handleDecline = useCallback(() => {
    if (!quotation) return;
    Alert.alert(
      'Decline Quotation',
      'Are you sure you want to decline this quotation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeclining(true);
              await declineQuotation(quotation.id);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to decline quotation');
            } finally {
              setDeclining(false);
            }
          },
        },
      ],
    );
  }, [quotation, declineQuotation, load]);

  const statusCfg = quotation
    ? (STATUS_CONFIG[quotation.status] ?? STATUS_CONFIG.draft)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-border">
        <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <ArrowLeft className="text-foreground" size={24} />
        </Pressable>
        <Text
          className="text-lg font-bold text-foreground flex-1 text-center"
          numberOfLines={1}
        >
          {loading ? 'Loading…' : (quotation?.reference ?? 'Quotation')}
        </Text>
        <View className="w-8" />
      </View>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" testID="quotation-detail-loading" />
        </View>
      )}

      {/* ── Error ───────────────────────────────────────────────────── */}
      {!loading && error && (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-destructive text-center" testID="quotation-detail-error">
            {error}
          </Text>
        </View>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {!loading && !error && quotation && (
        <ScrollView contentContainerStyle={{ paddingBottom: 64 }}>
          {/* Summary card */}
          <View className="m-6 bg-card border border-border rounded-2xl p-5">
            <View className="flex-row items-start justify-between mb-4">
              <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
                <FileText className="text-primary" size={22} />
              </View>
              <View className={`px-3 py-1 rounded-full ${statusCfg!.bgClass}`}>
                <Text className={`text-xs font-semibold ${statusCfg!.textClass}`}>
                  {statusCfg!.label}
                </Text>
              </View>
            </View>

            {/* Reference + project + vendor */}
            <Text
              className="text-2xl font-bold text-foreground mb-1"
              testID="quotation-detail-reference"
            >
              {quotation.reference}
            </Text>

            {/* Project row — only shown when projectId is set */}
            {quotation.projectId && (
              <View className="flex-row items-center gap-2 mb-2">
                <FolderOpen size={14} className="text-muted-foreground" />
                <Text
                  className="text-sm text-muted-foreground"
                  testID="quotation-detail-project-name"
                >
                  {projectName ?? quotation.projectId}
                </Text>
              </View>
            )}

            {quotation.vendorName ? (
              <Text
                className="text-muted-foreground text-sm mb-4"
                testID="quotation-detail-vendor-name"
              >
                {quotation.vendorName}
                {quotation.vendorAddress ? `\n${quotation.vendorAddress}` : ''}
              </Text>
            ) : null}

            {/* Total */}
            <Text className="text-3xl font-bold text-foreground mb-4">
              {formatCurrency(quotation.total, quotation.currency)}
            </Text>

            {/* Dates */}
            <View className="flex-row gap-4">
              <View className="flex-1 bg-muted/50 rounded-xl p-3">
                <Text className="text-xs text-muted-foreground uppercase mb-1">Issued</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatDate(quotation.date)}
                </Text>
              </View>
              {quotation.expiryDate ? (
                <View className="flex-1 bg-muted/50 rounded-xl p-3">
                  <Text className="text-xs text-muted-foreground uppercase mb-1">Expires</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatDate(quotation.expiryDate)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Line items */}
          {quotation.lineItems && quotation.lineItems.length > 0 ? (
            <View className="mx-6 mb-6">
              <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Line Items
              </Text>
              <View className="bg-card border border-border rounded-2xl overflow-hidden">
                {quotation.lineItems.map((item, idx) => (
                  <View
                    key={item.id ?? idx}
                    className={`px-4 py-3 flex-row items-start justify-between ${
                      idx < quotation.lineItems!.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <View className="flex-1 mr-4">
                      <Text className="text-sm text-foreground">{item.description}</Text>
                      {item.quantity && item.unitPrice ? (
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          {item.quantity} × {formatCurrency(item.unitPrice, quotation.currency)}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(item.total ?? item.unitPrice, quotation.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Notes */}
          {quotation.notes ? (
            <View className="mx-6 mb-6">
              <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Notes
              </Text>
              <View className="bg-card border border-border rounded-2xl p-4">
                <Text className="text-sm text-foreground leading-relaxed">
                  {quotation.notes}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
