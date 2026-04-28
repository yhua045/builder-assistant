import { formatCurrency } from "../../../utils/displayFormatters";


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
import { Payment } from '../../../domain/entities/Payment';
import { Invoice } from '../../../domain/entities/Invoice';
import { Project } from '../../../domain/entities/Project';
import { GetPaymentDetailsUseCase, PaymentDetailsDTO } from '../application/GetPaymentDetailsUseCase';
import { MarkPaymentAsPaidUseCase } from '../application/MarkPaymentAsPaidUseCase';
import { RecordPaymentUseCase } from '../application/RecordPaymentUseCase';
import { AssignProjectToPaymentRecordUseCase } from '../application/AssignProjectToPaymentRecordUseCase';
import type { DueStatus } from '../../../utils/getDueStatus';
import { invalidations } from '../../../hooks/queryKeys';
import '../../../infrastructure/di/registerServices';

export type { DueStatus };

// ── Input resolver (private helper) ──────────────────────────────────────────

function resolveInput(params: {
  paymentId?: string;
  syntheticRow?: Payment;
  invoiceId?: string;
}) {
  if (params.syntheticRow) return { syntheticRow: params.syntheticRow };
  if (params.paymentId)    return { paymentId: params.paymentId };
  if (params.invoiceId)    return { invoiceId: params.invoiceId };
  throw new Error('GetPaymentDetailsUseCase: no valid input provided');
}

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
  const [derivedData, setDerivedData] = useState<Partial<PaymentDetailsDTO>>({});

  const previousProjectIdRef = useRef<string | undefined>(undefined);
  const targetIdForUpdatesRef = useRef<string>('');

  // recordContext: initialised from syntheticRow param so first render is correct;
  // overwritten by loadData once the DTO arrives.
  const [recordContext, setRecordContext] = useState<'synthetic-invoice' | 'standalone-payment'>(() => {
    if (!syntheticRow) return 'standalone-payment';
    return (syntheticRow.id ?? '').startsWith('invoice-payable:') ? 'synthetic-invoice' : 'standalone-payment';
  });

  // ── DI resolution (once per mount) ────────────────────────────────────────

  const getDetailsUc = useMemo(
    () => container.resolve(GetPaymentDetailsUseCase),
    [],
  );
  const markPaidUc = useMemo(
    () => container.resolve(MarkPaymentAsPaidUseCase),
    [],
  );
  const recordPaymentUc = useMemo(
    () => container.resolve(RecordPaymentUseCase),
    [],
  );
  const assignProjectUc = useMemo(
    () => container.resolve(AssignProjectToPaymentRecordUseCase),
    [],
  );

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const input = resolveInput({ paymentId, syntheticRow, invoiceId: invoiceIdParam });
      const dto = await getDetailsUc.execute(input);

      setPayment(dto.payment);
      setInvoice(dto.invoice);
      setLinkedPayments(dto.linkedPayments);
      setProject(dto.project);
      setRecordContext(dto.recordContext);
      setDerivedData(dto);
      targetIdForUpdatesRef.current = dto.targetIdForUpdates;
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  }, [getDetailsUc, paymentId, syntheticRow, invoiceIdParam]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const isSyntheticRow = recordContext === 'synthetic-invoice';
  const resolvedProjectId = derivedData.resolvedProjectId;
  const dueStatus = derivedData.dueStatus ?? null;
  const totalSettled = derivedData.totalSettled ?? 0;
  const remainingBalance = derivedData.remainingBalance ?? 0;
  const canRecordPayment = derivedData.canRecordPayment ?? false;
  // Fall back to local computation before loadData populates derivedData (e.g. syntheticRow pre-render)
  const isPending = derivedData.isPending ?? (payment?.status === 'pending' || payment?.status == null);
  // UI rules: read from derivedData
  const showMarkAsPaidFallback = !invoice && isPending && !isSyntheticRow;
  const projectRowInteractive = isPending;
  const showEditIcon = isPending && !isSyntheticRow;

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
      if (!targetIdForUpdatesRef.current) return;
      const oldProjectId = previousProjectIdRef.current;
      const newProjectId = selectedProject?.id;
      try {
        await assignProjectUc.execute({
          recordContext,
          targetId: targetIdForUpdatesRef.current,
          projectId: newProjectId,
        });
        await Promise.all(
          invalidations
            .paymentProjectAssigned({ oldProjectId, newProjectId, isInvoice: recordContext === 'synthetic-invoice' })
            .map((key) => queryClient.invalidateQueries({ queryKey: key })),
        );
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Failed to update project assignment');
      }
    },
    [recordContext, assignProjectUc, queryClient, loadData],
  );

  const handleMarkAsPaid = useCallback(() => {
    // Invoice-linked path (synthetic row): record a new settled payment against the invoice
    if (isSyntheticRow) {
      if (!canRecordPayment) return;

      Alert.alert('Mark as Paid', `Confirm full payment of ${formatCurrency(remainingBalance)}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setMarking(true);
            try {
              await recordPaymentUc.execute({
                invoiceId: invoice!.id,
                amount: remainingBalance,
              });
              await Promise.all(
                invalidations
                  .paymentRecorded({ projectId: invoice?.projectId })
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
    if (!payment) return;
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
  }, [isSyntheticRow, canRecordPayment, remainingBalance, invoice, payment, markPaidUc, recordPaymentUc, queryClient, navigation]);

  const handlePartialPaymentSubmit = useCallback(async () => {
    const amountNum = parseFloat(partialAmountRaw);
    if (!amountNum || amountNum <= 0 || amountNum > remainingBalance) {
      setPartialAmountError(
        `Enter a valid amount between $0.01 and ${formatCurrency(remainingBalance)}.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      await recordPaymentUc.execute({
        invoiceId: invoice!.id,
        amount: amountNum,
      });
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
  }, [remainingBalance, invoice, partialAmountRaw, recordPaymentUc, queryClient, loadData]);

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
