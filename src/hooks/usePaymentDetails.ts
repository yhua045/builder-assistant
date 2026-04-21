import { formatCurrency, formatDate } from "../utils/displayFormatters";


/**
 * usePaymentDetails — View-Model Facade for PaymentDetails screen.
 *
 * Design: design/issue-210-payment-details-refactor.md §4
 *
 * Encapsulates:
 *  - Route param extraction (paymentId, syntheticRow, invoiceId)
 *  - DI container resolution + use case wiring
 *  - Full async loadData orchestration
 *  - Business rule derivations (isSyntheticRow, canRecordPayment, etc.)
 *  - Modal state (projectPicker, pendingForm, partialModal)
 *  - Action handlers (handleMarkAsPaid, handleSelectProject, etc.)
 *  - AUD/en-AU formatting helpers
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Payment } from '../domain/entities/Payment';
import { Invoice } from '../domain/entities/Invoice';
import { Project } from '../domain/entities/Project';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';
import { MarkPaymentAsPaidUseCase } from '../application/usecases/payment/MarkPaymentAsPaidUseCase';
import { RecordPaymentUseCase } from '../application/usecases/payment/RecordPaymentUseCase';
import { LinkPaymentToProjectUseCase } from '../application/usecases/payment/LinkPaymentToProjectUseCase';
import { LinkInvoiceToProjectUseCase } from '../application/usecases/invoice/LinkInvoiceToProjectUseCase';
import { getDueStatus } from '../utils/getDueStatus';
import type { DueStatus } from '../utils/getDueStatus';
import { invalidations } from './queryKeys';
import '../infrastructure/di/registerServices';

export type { DueStatus };

// ── AUD / en-AU formatting helpers (stable module-level functions) ─────────────



// ── Public interface ──────────────────────────────────────────────────────────

export interface PaymentDetailsViewModel {
  // ── Core data ──────────────────────────────────────────────────────────────
  payment: Payment | null;
  invoice: Invoice | null;
  linkedPayments: Payment[];
  project: Project | null;

  // ── Async states ───────────────────────────────────────────────────────────
  loading: boolean;
  marking: boolean;
  submitting: boolean;

  // ── Derived presentation state ─────────────────────────────────────────────
  isSyntheticRow: boolean;
  resolvedProjectId: string | undefined;
  dueStatus: DueStatus | null;
  totalSettled: number;
  remainingBalance: number;
  canRecordPayment: boolean;
  showMarkAsPaidFallback: boolean;
  isPending: boolean;
  projectRowInteractive: boolean;
  showEditIcon: boolean;

  // ── Modal / UI state ───────────────────────────────────────────────────────
  projectPickerVisible: boolean;
  pendingFormVisible: boolean;
  partialModalVisible: boolean;
  partialAmount: string;
  partialAmountError: string;

  // ── Formatting helpers (AUD / en-AU locale) ────────────────────────────────

  // ── Actions ────────────────────────────────────────────────────────────────
  handleMarkAsPaid: () => void;
  handlePartialPaymentSubmit: () => Promise<void>;
  handleSelectProject: (project: Project | undefined) => Promise<void>;
  handleNavigateToProject: () => void;
  openPartialModal: () => void;
  closePartialModal: () => void;
  setPartialAmount: (amount: string) => void;
  setProjectPickerVisible: (visible: boolean) => void;
  setPendingFormVisible: (visible: boolean) => void;
  goBack: () => void;
  reload: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePaymentDetails(): PaymentDetailsViewModel {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const { paymentId, syntheticRow, invoiceId: invoiceIdParam } = (route.params ?? {}) as {
    paymentId?: string;
    syntheticRow?: Payment;
    invoiceId?: string;
  };

  // ── State ──────────────────────────────────────────────────────────────────

  const [payment, setPayment] = useState<Payment | null>(syntheticRow ?? null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<Payment[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [pendingFormVisible, setPendingFormVisible] = useState(false);
  const [loading, setLoading] = useState(!syntheticRow || !!invoiceIdParam);
  const [marking, setMarking] = useState(false);
  const [partialModalVisible, setPartialModalVisible] = useState(false);
  const [partialAmountRaw, setPartialAmountRaw] = useState('');
  const [partialAmountError, setPartialAmountError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const previousProjectIdRef = useRef<string | undefined>(undefined);

  // ── DI resolution (once per mount) ────────────────────────────────────────

  const paymentRepo = useMemo(
    () => container.resolve<PaymentRepository>('PaymentRepository' as any),
    [],
  );
  const invoiceRepo = useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository' as any),
    [],
  );
  const projectRepo = useMemo(
    () => container.resolve<ProjectRepository>('ProjectRepository' as any),
    [],
  );

  // ── Use-case wiring ────────────────────────────────────────────────────────

  const markPaidUc = useMemo(
    () => new MarkPaymentAsPaidUseCase(paymentRepo, invoiceRepo),
    [paymentRepo, invoiceRepo],
  );
  const recordPaymentUc = useMemo(
    () => new RecordPaymentUseCase(paymentRepo, invoiceRepo),
    [paymentRepo, invoiceRepo],
  );
  const linkPaymentUc = useMemo(
    () => new LinkPaymentToProjectUseCase(paymentRepo),
    [paymentRepo],
  );
  const linkInvoiceUc = useMemo(
    () => new LinkInvoiceToProjectUseCase(invoiceRepo),
    [invoiceRepo],
  );

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      // Invoice-entry path: opened from a TimelineInvoiceCard with invoiceId param.
      if (invoiceIdParam && !paymentId && !syntheticRow) {
        const [inv, payments] = await Promise.all([
          invoiceRepo.getInvoice(invoiceIdParam),
          paymentRepo.findByInvoice(invoiceIdParam),
        ]);
        setInvoice(inv);
        setLinkedPayments(payments);

        if (inv) {
          const settled = payments
            .filter((p) => p.status === 'settled')
            .reduce((sum, p) => sum + (p.amount ?? 0), 0);
          const outstanding = inv.total - settled;
          const syntheticPayment: Payment = {
            id: `invoice-payable:${inv.id}`,
            invoiceId: inv.id,
            projectId: inv.projectId,
            amount: outstanding,
            currency: inv.currency,
            date: inv.dateIssued ?? inv.issueDate,
            dueDate: inv.dateDue ?? inv.dueDate ?? null,
            status: 'pending',
            contractorName: inv.issuerName ?? inv.vendor ?? 'Invoice Payable',
            notes: inv.notes,
            reference: inv.externalReference ?? inv.externalId ?? inv.id,
            stageLabel: inv.externalReference ?? inv.invoiceNumber,
          } as unknown as Payment;
          setPayment(syntheticPayment);

          if (inv.projectId) {
            try {
              const proj = await projectRepo.findById(inv.projectId);
              setProject(proj);
            } catch {
              setProject(null);
            }
          }
        } else {
          setPayment(null);
        }
        return;
      }

      let resolved = syntheticRow ?? null;
      const isSynthetic = resolved?.id?.startsWith('invoice-payable:');

      if (!isSynthetic && paymentId) {
        resolved = await paymentRepo.findById(paymentId);
      }

      setPayment(resolved);

      const projectId = isSynthetic ? undefined : resolved?.projectId;

      if (!isSynthetic && projectId) {
        try {
          const proj = await projectRepo.findById(projectId);
          setProject(proj);
        } catch {
          setProject(null);
        }
      } else if (!isSynthetic) {
        setProject(null);
      }

      const resolvedInvoiceId = resolved?.invoiceId;
      if (resolvedInvoiceId) {
        const [inv, payments] = await Promise.all([
          invoiceRepo.getInvoice(resolvedInvoiceId),
          paymentRepo.findByInvoice(resolvedInvoiceId),
        ]);
        setInvoice(inv);
        setLinkedPayments(payments.filter((p) => p.id !== resolved?.id));

        if (isSynthetic && inv?.projectId) {
          try {
            const proj = await projectRepo.findById(inv.projectId);
            setProject(proj);
          } catch {
            setProject(null);
          }
        } else if (isSynthetic) {
          setProject(null);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  }, [paymentId, syntheticRow, invoiceIdParam, paymentRepo, invoiceRepo, projectRepo]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const isSyntheticRow = (payment?.id ?? '').startsWith('invoice-payable:');
  const resolvedProjectId = isSyntheticRow ? invoice?.projectId : payment?.projectId;
  const dueStatus = payment?.dueDate ? getDueStatus(payment.dueDate) : null;
  const totalSettled = linkedPayments
    .filter((p) => p.status === 'settled')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const remainingBalance = invoice ? invoice.total - totalSettled : 0;
  const canRecordPayment =
    invoice !== null &&
    invoice.status !== 'cancelled' &&
    (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial') &&
    remainingBalance > 0;
  const showMarkAsPaidFallback =
    !invoice && payment?.status === 'pending' && !isSyntheticRow;
  const isPending = payment?.status === 'pending' || payment?.status == null;
  const projectRowInteractive = isPending;
  const showEditIcon = !!(isPending && !isSyntheticRow);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleNavigateToProject = useCallback(() => {
    if (!resolvedProjectId) return;
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Projects',
        params: {
          screen: 'ProjectDetail',
          params: { projectId: resolvedProjectId },
          initial: false,
        },
      }),
    );
  }, [resolvedProjectId, navigation]);

  const handleSelectProject = useCallback(
    async (selectedProject: Project | undefined) => {
      if (!payment) return;
      const isSynth = payment.id.startsWith('invoice-payable:');
      const oldProjectId = previousProjectIdRef.current;
      const newProjectId = selectedProject?.id;
      try {
        if (isSynth) {
          const invoiceId = payment.invoiceId;
          if (!invoiceId) return;
          await linkInvoiceUc.execute({ invoiceId, projectId: newProjectId });
        } else {
          await linkPaymentUc.execute({ paymentId: payment.id, projectId: newProjectId });
        }
        await Promise.all(
          invalidations
            .paymentProjectAssigned({ oldProjectId, newProjectId, isInvoice: isSynth })
            .map((key) => queryClient.invalidateQueries({ queryKey: key })),
        );
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Failed to update project assignment');
      }
    },
    [payment, linkPaymentUc, linkInvoiceUc, queryClient, loadData],
  );

  const handleMarkAsPaid = useCallback(() => {
    // Invoice-linked path: record a new settled payment against the invoice
    if (
      invoice &&
      invoice.status !== 'cancelled' &&
      (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial')
    ) {
      const settled = linkedPayments
        .filter((p) => p.status === 'settled')
        .reduce((sum, p) => sum + (p.amount ?? 0), 0);
      const balance = invoice.total - settled;
      if (balance <= 0) return;

      Alert.alert('Mark as Paid', `Confirm full payment of ${formatCurrency(balance)}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setMarking(true);
            try {
              const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              await recordPaymentUc.execute({
                id,
                invoiceId: invoice.id,
                amount: balance,
                status: 'settled',
                date: new Date().toISOString(),
              } as Payment);
              await Promise.all(
                invalidations
                  .paymentRecorded({ projectId: invoice.projectId })
                  .map((key) => queryClient.invalidateQueries({ queryKey: key })),
              );
              Alert.alert('Done', 'Payment recorded.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to record payment');
            } finally {
              setMarking(false);
            }
          },
        },
      ]);
      return;
    }

    // Fallback: standalone payment record (no linked invoice)
    if (!payment || payment.id.startsWith('invoice-payable:')) return;
    Alert.alert('Mark as Paid', `Confirm payment of ${formatCurrency(payment.amount ?? 0)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setMarking(true);
          try {
            await markPaidUc.execute({ paymentId: payment.id });
            await Promise.all(
              invalidations
                .paymentRecorded({})
                .map((key) => queryClient.invalidateQueries({ queryKey: key })),
            );
            Alert.alert('Done', 'Payment marked as settled.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to mark payment as paid');
          } finally {
            setMarking(false);
          }
        },
      },
    ]);
  }, [invoice, payment, linkedPayments, markPaidUc, recordPaymentUc, queryClient, navigation]);

  const handlePartialPaymentSubmit = useCallback(async () => {
    const settled = linkedPayments
      .filter((p) => p.status === 'settled')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const balance = invoice ? invoice.total - settled : 0;
    const amountNum = parseFloat(partialAmountRaw);
    if (!amountNum || amountNum <= 0 || amountNum > balance) {
      setPartialAmountError(
        `Enter a valid amount between $0.01 and ${formatCurrency(balance)}.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await recordPaymentUc.execute({
        id,
        invoiceId: invoice!.id,
        amount: amountNum,
        status: 'settled',
        date: new Date().toISOString(),
      } as Payment);
      await Promise.all(
        invalidations
          .paymentRecorded({ projectId: invoice?.projectId })
          .map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
      setPartialModalVisible(false);
      setPartialAmountRaw('');
      setPartialAmountError('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  }, [linkedPayments, invoice, partialAmountRaw, recordPaymentUc, queryClient, loadData]);

  const openPartialModal = useCallback(() => {
    setPartialAmountRaw(remainingBalance.toString());
    setPartialAmountError('');
    setPartialModalVisible(true);
  }, [remainingBalance]);

  const closePartialModal = useCallback(() => {
    setPartialModalVisible(false);
  }, []);

  const setPartialAmount = useCallback((amount: string) => {
    setPartialAmountRaw(amount);
    setPartialAmountError('');
  }, []);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const reload = useCallback(() => {
    loadData();
  }, [loadData]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    previousProjectIdRef.current = resolvedProjectId;
  }, [resolvedProjectId]);

  // ── Return view-model ──────────────────────────────────────────────────────

  return {
    payment,
    invoice,
    linkedPayments,
    project,
    loading,
    marking,
    submitting,
    isSyntheticRow,
    resolvedProjectId,
    dueStatus,
    totalSettled,
    remainingBalance,
    canRecordPayment,
    showMarkAsPaidFallback: !!showMarkAsPaidFallback,
    isPending: !!isPending,
    projectRowInteractive: !!projectRowInteractive,
    showEditIcon,
    projectPickerVisible,
    pendingFormVisible,
    partialModalVisible,
    partialAmount: partialAmountRaw,
    partialAmountError,
    handleMarkAsPaid,
    handlePartialPaymentSubmit,
    handleSelectProject,
    handleNavigateToProject,
    openPartialModal,
    closePartialModal,
    setPartialAmount,
    setProjectPickerVisible,
    setPendingFormVisible,
    goBack,
    reload,
  };
}
