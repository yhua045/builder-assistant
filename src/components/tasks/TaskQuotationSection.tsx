/**
 * TaskQuotationSection
 *
 * Read-only summary of the quote and (when accepted) the linked invoice
 * for a variation / contract_work task.
 *
 * Rendered by TaskDetailsPage. Reusable anywhere a Task + optional Invoice pair
 * needs to be displayed compactly.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { FileText, Clock, DollarSign } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import type { TaskViewDTO, InvoiceViewDTO } from '../../application/dtos/TaskViewDTOs';


cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface TaskQuotationSectionProps {
  task: TaskViewDTO;
  /** Pre-fetched invoice when task.quoteInvoiceId is set. Null/undefined = not yet loaded or not linked. */
  invoice?: InvoiceViewDTO | null;
}

// ── Style maps ────────────────────────────────────────────────────────────────

type QuoteStatusConfig = { label: string; bgClass: string; textClass: string };

const QUOTE_STATUS_CONFIG: Record<NonNullable<TaskViewDTO['quoteStatus']>, QuoteStatusConfig> = {
  pending:  { label: 'Pending',  bgClass: 'bg-muted',         textClass: 'text-muted-foreground' },
  issued:   { label: 'Issued',   bgClass: 'bg-blue-100',      textClass: 'text-blue-700' },
  accepted: { label: 'Accepted', bgClass: 'bg-green-100',     textClass: 'text-green-700' },
  rejected: { label: 'Rejected', bgClass: 'bg-red-100',       textClass: 'text-red-600' },
};

type InvoiceStatusConfig = { label: string; bgClass: string; textClass: string };

const INVOICE_STATUS_CONFIG: Record<InvoiceViewDTO['status'], InvoiceStatusConfig> = {
  draft:     { label: 'Draft',     bgClass: 'bg-muted',       textClass: 'text-muted-foreground' },
  issued:    { label: 'Issued',    bgClass: 'bg-blue-100',    textClass: 'text-blue-700' },
  paid:      { label: 'Paid',      bgClass: 'bg-green-100',   textClass: 'text-green-700' },
  overdue:   { label: 'Overdue',   bgClass: 'bg-red-100',     textClass: 'text-red-600' },
  cancelled: { label: 'Cancelled', bgClass: 'bg-muted',       textClass: 'text-muted-foreground' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | undefined, currency = 'AUD'): string {
  if (amount == null) return '—';
  return `${currency} ${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskQuotationSection({ task, invoice }: TaskQuotationSectionProps) {
  // Only show if the task has quote data attached
  const hasQuoteData =
    task.taskType === 'variation' ||
    task.taskType === 'contract_work' ||
    task.quoteAmount != null ||
    task.quoteStatus != null;

  if (!hasQuoteData) return null;

  const quoteStatusCfg = QUOTE_STATUS_CONFIG[task.quoteStatus ?? 'pending'];

  return (
    <View className="px-6 mb-6">
      <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Quotation / Invoice
      </Text>

      <View className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* ── Quote row ─────────────────────────────────────────────────────── */}
        <View className="p-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center">
              <FileText className="text-primary" size={18} />
            </View>
            <View>
              <Text className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-0.5">
                Quote Amount
              </Text>
              <Text className="text-base font-bold text-foreground">
                {formatCurrency(task.quoteAmount ?? undefined)}
              </Text>
            </View>
          </View>

          {/* Quote status pill */}
          <View className={`px-3 py-1 rounded-full ${quoteStatusCfg.bgClass}`}>
            <Text className={`text-xs font-semibold ${quoteStatusCfg.textClass}`}>
              {quoteStatusCfg.label}
            </Text>
          </View>
        </View>

        {/* ── Invoice sub-card (accepted + invoice linked) ──────────────────── */}
        {task.quoteStatus === 'accepted' && invoice && (() => {
          const invoiceStatusCfg =
            INVOICE_STATUS_CONFIG[invoice.status] ?? INVOICE_STATUS_CONFIG.draft;
          const invoiceRef =
            invoice.invoiceNumber ??
            invoice.externalReference ??
            invoice.externalId ??
            '—';
          const issuedDate = invoice.dateIssued ?? invoice.issueDate;
          const dueDate = invoice.dateDue ?? invoice.dueDate;

          return (
            <>
              <View className="border-t border-border" />
              <View className="p-4">
                {/* Invoice header row */}
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Invoice
                  </Text>
                  <View className={`px-3 py-1 rounded-full ${invoiceStatusCfg.bgClass}`}>
                    <Text className={`text-xs font-semibold ${invoiceStatusCfg.textClass}`}>
                      {invoiceStatusCfg.label}
                    </Text>
                  </View>
                </View>

                {/* Invoice # and total */}
                <View className="flex-row gap-4 mb-3">
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground mb-1">Invoice #</Text>
                    <Text className="text-sm font-semibold text-foreground">{invoiceRef}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground mb-1">Total</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </Text>
                  </View>
                </View>

                {/* Dates */}
                <View className="flex-row gap-4 mb-3">
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground mb-1">Issued</Text>
                    <Text className="text-sm text-foreground">{formatDate(issuedDate)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground mb-1">Due</Text>
                    <Text className="text-sm text-foreground">{formatDate(dueDate)}</Text>
                  </View>
                </View>

                {/* Payment status */}
                <View className="flex-row items-center gap-2">
                  <DollarSign className="text-muted-foreground" size={14} />
                  <Text className="text-xs text-muted-foreground">
                    Payment:{' '}
                    <Text className="font-semibold text-foreground capitalize">
                      {invoice.paymentStatus}
                    </Text>
                  </Text>
                </View>
              </View>
            </>
          );
        })()}

        {/* ── Accepted but invoice not yet generated ────────────────────────── */}
        {task.quoteStatus === 'accepted' && !invoice && (
          <>
            <View className="border-t border-border" />
            <View className="p-4 flex-row items-center gap-2">
              <Clock className="text-muted-foreground" size={14} />
              <Text className="text-xs text-muted-foreground italic">
                Invoice not yet generated
              </Text>
            </View>
          </>
        )}

      </View>
    </View>
  );
}
