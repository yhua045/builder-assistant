import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { container } from 'tsyringe';
import { Payment } from '../../domain/entities/Payment';
import { Invoice } from '../../domain/entities/Invoice';
import { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../domain/repositories/InvoiceRepository';
import { MarkPaymentAsPaidUseCase } from '../../application/usecases/payment/MarkPaymentAsPaidUseCase';
import { getDueStatus } from '../../utils/getDueStatus';
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

  const { paymentId, syntheticRow } = route.params as {
    paymentId?: string;
    syntheticRow?: Payment;
  };

  const [payment, setPayment] = useState<Payment | null>(syntheticRow ?? null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(!syntheticRow);
  const [marking, setMarking] = useState(false);

  const paymentRepo = React.useMemo(
    () => container.resolve<PaymentRepository>('PaymentRepository' as any),
    [],
  );
  const invoiceRepo = React.useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository' as any),
    [],
  );
  const markPaidUc = React.useMemo(
    () => new MarkPaymentAsPaidUseCase(paymentRepo, invoiceRepo),
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
  }, [paymentId, syntheticRow, paymentRepo, invoiceRepo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAsPaid = () => {
    if (!payment || payment.id.startsWith('invoice-payable:')) {
      Alert.alert(
        'Record Payment',
        'This obligation is derived from an invoice. Please record a payment against the invoice directly.',
      );
      return;
    }

    Alert.alert('Mark as Paid', `Confirm payment of ${formatCurrency(payment.amount ?? 0)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setMarking(true);
          try {
            await markPaidUc.execute({ paymentId: payment.id });
            Alert.alert('Done', 'Payment marked as settled.', [
              { text: 'OK', onPress: () => { navigation.goBack(); } },
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
                payment.status === 'settled' ? 'bg-green-100' : 'bg-amber-100'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  payment.status === 'settled' ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {payment.status === 'settled' ? 'Settled' : 'Pending'}
              </Text>
            </View>
            {dueStatus && payment.status !== 'settled' && (
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

        {/* Mark as paid CTA */}
        {payment.status === 'pending' && !isSynthetic && (
          <TouchableOpacity
            onPress={handleMarkAsPaid}
            disabled={marking}
            className="bg-primary rounded-xl py-4 items-center mb-6"
            activeOpacity={0.8}
          >
            {marking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-primary-foreground font-bold text-base">
                Mark as Paid
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
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
