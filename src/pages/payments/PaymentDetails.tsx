import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, X, DollarSign } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { container } from 'tsyringe';
import { Payment } from '../../domain/entities/Payment';
import { Invoice } from '../../domain/entities/Invoice';
import { Project } from '../../domain/entities/Project';
import { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../domain/repositories/InvoiceRepository';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { MarkPaymentAsPaidUseCase } from '../../application/usecases/payment/MarkPaymentAsPaidUseCase';
import { RecordPaymentUseCase } from '../../application/usecases/payment/RecordPaymentUseCase';
import { getDueStatus } from '../../utils/getDueStatus';
import { invalidations, queryKeys } from '../../hooks/queryKeys';
import { ProjectPickerModal } from '../../components/shared/ProjectPickerModal';
import '../../infrastructure/di/registerServices';

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(amount);

const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export default function PaymentDetails() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#e4e4e7' : '#18181b';
  const queryClient = useQueryClient();

  const { paymentId, syntheticRow } = route.params as {
    paymentId?: string;
    syntheticRow?: Payment;
  };

  const [payment, setPayment] = useState<Payment | null>(syntheticRow ?? null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<Payment[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [loading, setLoading] = useState(!syntheticRow);
  const [marking, setMarking] = useState(false);
  const [partialModalVisible, setPartialModalVisible] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialAmountError, setPartialAmountError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const previousProjectIdRef = useRef<string | undefined>(undefined);

  const paymentRepo = React.useMemo(
    () => container.resolve<PaymentRepository>('PaymentRepository' as any),
    [],
  );
  const invoiceRepo = React.useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository' as any),
    [],
  );
  const projectRepo = React.useMemo(
    () => container.resolve<ProjectRepository>('ProjectRepository' as any),
    [],
  );
  const markPaidUc = React.useMemo(
    () => new MarkPaymentAsPaidUseCase(paymentRepo, invoiceRepo),
    [paymentRepo, invoiceRepo],
  );
  const recordPaymentUc = React.useMemo(
    () => new RecordPaymentUseCase(paymentRepo, invoiceRepo),
    [paymentRepo, invoiceRepo],
  );

  const loadData = useCallback(async () => {
    try {
      let resolved = syntheticRow ?? null;

      // Synthetic rows (id starts with "invoice-payable:") don't exist in DB
      const isSynthetic = resolved?.id?.startsWith('invoice-payable:');

      if (!isSynthetic && paymentId) {
        resolved = await paymentRepo.findById(paymentId);
      }

      setPayment(resolved);

      // Load project if present (and not a synthetic row)
      if (!isSynthetic && resolved?.projectId) {
        try {
          const proj = await projectRepo.findById(resolved.projectId);
          setProject(proj);
        } catch {
          setProject(null);
        }
      } else {
        setProject(null);
      }

      // Load parent invoice for context
      const invoiceId = resolved?.invoiceId;
      if (invoiceId) {
        const [inv, payments] = await Promise.all([
          invoiceRepo.getInvoice(invoiceId),
          paymentRepo.findByInvoice(invoiceId),
        ]);
        setInvoice(inv);
        setLinkedPayments(payments.filter((p) => p.id !== resolved?.id));
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  }, [paymentId, syntheticRow, paymentRepo, invoiceRepo, projectRepo]);

  const handleSelectProject = useCallback(
    async (selectedProject: Project | undefined) => {
      if (!payment || payment.id.startsWith('invoice-payable:')) return;
      const oldProjectId = previousProjectIdRef.current;
      const newProjectId = selectedProject?.id;
      try {
        await paymentRepo.update({ ...payment, projectId: newProjectId });
        // Invalidate affected cache entries
        const keysToInvalidate = [
          queryKeys.paymentsAll(),
          queryKeys.paidPaymentsGlobal(),
          queryKeys.unassignedPaymentsGlobal(),
          ...(oldProjectId ? [queryKeys.projectPayments(oldProjectId)] : []),
          ...(newProjectId ? [queryKeys.projectPayments(newProjectId)] : []),
        ];
        await Promise.all(
          keysToInvalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })),
        );
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Failed to update project assignment');
      }
    },
    [payment, paymentRepo, queryClient, loadData],
  );

  const handleNavigateToProject = useCallback(() => {
    if (!payment?.projectId) return;
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Projects',
        params: {
          screen: 'ProjectDetail',
          params: { projectId: payment.projectId },
          initial: false,
        },
      }),
    );
  }, [payment, navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Track previousProjectId before each assignment
  useEffect(() => {
    previousProjectIdRef.current = payment?.projectId;
  }, [payment?.projectId]);

  const handleMarkAsPaid = () => {
    // Invoice-linked path: record a new settled payment against the invoice
    if (invoice && invoice.status !== 'cancelled' &&
        (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial')) {
      const settled = linkedPayments
        .filter(p => p.status === 'settled')
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
              });
              await Promise.all(
                invalidations.paymentRecorded({ projectId: invoice.projectId })
                  .map(key => queryClient.invalidateQueries({ queryKey: key }))
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
              invalidations.paymentRecorded({})
                .map(key => queryClient.invalidateQueries({ queryKey: key }))
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
  };

  const handlePartialPaymentSubmit = async () => {
    const settled = linkedPayments
      .filter(p => p.status === 'settled')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const balance = invoice ? invoice.total - settled : 0;
    const amountNum = parseFloat(partialAmount);
    if (!amountNum || amountNum <= 0 || amountNum > balance) {
      setPartialAmountError(`Enter a valid amount between $0.01 and ${formatCurrency(balance)}.`);
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
      });
      await Promise.all(
        invalidations.paymentRecorded({ projectId: invoice?.projectId })
          .map(key => queryClient.invalidateQueries({ queryKey: key }))
      );
      setPartialModalVisible(false);
      setPartialAmount('');
      setPartialAmountError('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!payment) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Payment not found.</Text>
      </SafeAreaView>
    );
  }

  const isSynthetic = payment.id.startsWith('invoice-payable:');
  const dueStatus = payment.dueDate ? getDueStatus(payment.dueDate) : null;
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
    !invoice && payment.status === 'pending' && !isSynthetic;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-4 pb-3 border-b border-border flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <ChevronLeft size={24} color={iconColor} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground flex-1" numberOfLines={1}>
          {payment.contractorName ?? 'Payment Detail'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={styles.content}>
        {/* Amount + Status */}
        <View className="bg-card border border-border rounded-xl p-4 mb-4">
          <Text className="text-3xl font-bold text-foreground mb-1">
            {formatCurrency(payment.amount ?? 0)}
          </Text>
          <View className="flex-row items-center gap-2">
            <View
              className={`px-2 py-0.5 rounded ${
                payment.status === 'settled' ? 'bg-green-100' :
                payment.status === 'cancelled' ? 'bg-red-100' :
                payment.status === 'reverse_payment' ? 'bg-purple-100' :
                'bg-amber-100'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  payment.status === 'settled' ? 'text-green-700' :
                  payment.status === 'cancelled' ? 'text-red-700' :
                  payment.status === 'reverse_payment' ? 'text-purple-700' :
                  'text-amber-700'
                }`}
              >
                {payment.status === 'settled' ? 'Settled' :
                 payment.status === 'cancelled' ? 'Cancelled' :
                 payment.status === 'reverse_payment' ? 'Reversed' :
                 'Pending'}
              </Text>
            </View>
            {dueStatus && payment.status === 'pending' && (
              <Text style={{ color: dueStatus.style === 'overdue' ? '#dc2626' : dueStatus.style === 'due-soon' ? '#d97706' : '#16a34a' }} className="text-xs font-semibold">
                {dueStatus.text}
              </Text>
            )}
          </View>
        </View>

        {/* Invoice summary */}
        {invoice && (
          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Invoice
            </Text>
            <Row label="Reference" value={invoice.externalReference ?? invoice.invoiceNumber ?? invoice.id} />
            <Row label="Issued by" value={invoice.issuerName ?? '—'} />
            <Row label="Issue date" value={formatDate(invoice.dateIssued ?? invoice.issueDate)} />
            <Row label="Due date" value={formatDate(invoice.dateDue ?? invoice.dueDate)} />
            <Row label="Total" value={formatCurrency(invoice.total)} />
            <Row label="Payment status" value={invoice.paymentStatus} />
            {invoice.status === 'cancelled' && (
              <View className="mt-2 bg-red-50 rounded px-3 py-2">
                <Text className="text-xs text-red-600 font-semibold">Invoice cancelled</Text>
              </View>
            )}
          </View>
        )}

        {/* Payment details */}
        <View className="bg-card border border-border rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Details
          </Text>
          <Row label="Category" value={payment.paymentCategory ?? '—'} />
          <Row label="Stage" value={payment.stageLabel ?? '—'} />
          <Row label="Due" value={formatDate(payment.dueDate)} />
          <Row label="Method" value={payment.method ?? '—'} />
          <Row label="Reference" value={payment.reference ?? '—'} />
          {payment.notes ? <Row label="Notes" value={payment.notes} /> : null}

          {/* Project row — only for non-synthetic payments */}
          {!isSynthetic && (
            <TouchableOpacity
              testID="project-row"
              onPress={() => setProjectPickerVisible(true)}
              className="flex-row justify-between items-center py-1.5"
              activeOpacity={0.7}
            >
              <Text className="text-sm text-muted-foreground">Project</Text>
              <View className="flex-row items-center gap-1 flex-shrink ml-4">
                {project ? (
                  <Text className="text-sm text-primary font-medium text-right" numberOfLines={1}>
                    {project.name}
                  </Text>
                ) : (
                  <Text className="text-sm text-muted-foreground font-medium text-right">
                    Unassigned
                  </Text>
                )}
                <ChevronRight size={14} color={isDark ? '#a1a1aa' : '#71717a'} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Payment history for this invoice */}
        {linkedPayments.length > 0 && (
          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Payment History
            </Text>
            {linkedPayments.map((p) => (
              <View key={p.id} className="flex-row items-center justify-between py-2 border-b border-border last:border-0">
                <View>
                  <Text className="text-sm text-foreground">{formatDate(p.date ?? p.updatedAt)}</Text>
                  <Text className="text-xs text-muted-foreground capitalize">{p.status}</Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">{formatCurrency(p.amount ?? 0)}</Text>
              </View>
            ))}
            {totalSettled > 0 && (
              <View className="flex-row justify-between pt-2 mt-1">
                <Text className="text-sm font-semibold text-foreground">Total settled</Text>
                <Text className="text-sm font-semibold text-green-600">{formatCurrency(totalSettled)}</Text>
              </View>
            )}
          </View>
        )}

        {/* CTAs */}
        {(canRecordPayment || showMarkAsPaidFallback) && (
          <View className="gap-3 mb-6">
            <TouchableOpacity
              onPress={handleMarkAsPaid}
              disabled={marking}
              className="bg-primary rounded-xl py-4 items-center"
              activeOpacity={0.8}
            >
              {marking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-primary-foreground font-bold text-base">Mark as Paid</Text>
              )}
            </TouchableOpacity>

            {canRecordPayment && (
              <TouchableOpacity
                onPress={() => {
                  setPartialAmount(remainingBalance.toString());
                  setPartialAmountError('');
                  setPartialModalVisible(true);
                }}
                className="border border-primary rounded-xl py-4 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-primary font-bold text-base">Make Partial Payment</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Project Picker Modal — #191 */}
      <ProjectPickerModal
        visible={projectPickerVisible}
        currentProjectId={payment?.projectId}
        onSelect={handleSelectProject}
        onNavigate={handleNavigateToProject}
        onClose={() => setProjectPickerVisible(false)}
      />

      {/* Partial Payment Modal */}
      <Modal
        visible={partialModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPartialModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50"
            activeOpacity={1}
            onPress={() => setPartialModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="w-full bg-white dark:bg-gray-900 rounded-t-3xl mt-auto border-t border-gray-200 dark:border-gray-800"
            >
              {/* Handle bar */}
              <View className="w-full items-center pt-3 pb-1">
                <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </View>

              <View className="p-6">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">Partial Payment</Text>
                  <TouchableOpacity onPress={() => setPartialModalVisible(false)}>
                    <X size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>

                {/* Invoice info */}
                {invoice && (
                  <View className="mb-6">
                    <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
                      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Invoice</Text>
                      <Text className="text-base font-bold text-gray-900 dark:text-white mb-3">
                        {invoice.externalReference ?? invoice.invoiceNumber ?? invoice.id}
                      </Text>
                      <View className="flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                        <View>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">Issued by</Text>
                          <Text className="text-sm font-medium text-gray-900 dark:text-white">{invoice.issuerName ?? '—'}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xs text-gray-500 dark:text-gray-400">Due date</Text>
                          <Text className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(invoice.dateDue ?? invoice.dueDate)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row items-end justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                      <View>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Invoice</Text>
                        <Text className="text-base text-gray-400 dark:text-gray-500 line-through">
                          {formatCurrency(invoice.total)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Remaining Balance</Text>
                        <Text className="text-xl font-bold text-primary">{formatCurrency(remainingBalance)}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Amount input */}
                <View className="mb-6">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Payment Amount</Text>
                  <View className="flex-row items-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3">
                    <DollarSign size={20} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
                    <TextInput
                      className="flex-1 text-2xl font-bold text-gray-900 dark:text-white"
                      placeholder="0.00"
                      value={partialAmount}
                      onChangeText={(t) => { setPartialAmount(t); setPartialAmountError(''); }}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  {!!partialAmountError && (
                    <Text className="text-xs text-red-500 mt-1">{partialAmountError}</Text>
                  )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setPartialModalVisible(false)}
                    className="flex-1 py-3.5 rounded-xl border border-gray-300 dark:border-gray-600 items-center justify-center"
                  >
                    <Text className="font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handlePartialPaymentSubmit}
                    disabled={submitting}
                    className="flex-1 py-3.5 rounded-xl bg-primary items-center justify-center"
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="font-semibold text-white">Mark as Paid</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm text-foreground font-medium flex-shrink ml-4 text-right">{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
});
