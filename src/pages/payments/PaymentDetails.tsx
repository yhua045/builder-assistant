import { formatCurrency, formatDate } from "../../utils/displayFormatters";

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Pencil, X, DollarSign } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { usePaymentDetails } from '../../hooks/usePaymentDetails';
import { PendingPaymentForm } from '../../components/payments/PendingPaymentForm';
import { ProjectPickerModal } from '../../components/shared/ProjectPickerModal';

export default function PaymentDetails() {
  const vm = usePaymentDetails();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#e4e4e7' : '#18181b';

  if (vm.loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!vm.payment) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Payment not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-4 pb-3 border-b border-border flex-row items-center">
        <TouchableOpacity
          onPress={vm.goBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <ChevronLeft size={24} color={iconColor} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground flex-1" numberOfLines={1}>
          {vm.payment.contractorName ?? 'Payment Detail'}
        </Text>
        {vm.showEditIcon && (
          <TouchableOpacity
            testID="edit-payment-btn"
            onPress={() => vm.setPendingFormVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="ml-2"
          >
            <Pencil size={16} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={styles.content}>
        {/* Amount + Status */}
        <View className="bg-card border border-border rounded-xl p-4 mb-4">
          <Text className="text-3xl font-bold text-foreground mb-1">
            {formatCurrency(vm.payment.amount ?? 0)}
          </Text>
          <View className="flex-row items-center gap-2">
            <View
              className={`px-2 py-0.5 rounded ${
                vm.payment.status === 'settled' ? 'bg-green-100' :
                vm.payment.status === 'cancelled' ? 'bg-red-100' :
                vm.payment.status === 'reverse_payment' ? 'bg-purple-100' :
                'bg-amber-100'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  vm.payment.status === 'settled' ? 'text-green-700' :
                  vm.payment.status === 'cancelled' ? 'text-red-700' :
                  vm.payment.status === 'reverse_payment' ? 'text-purple-700' :
                  'text-amber-700'
                }`}
              >
                {vm.payment.status === 'settled' ? 'Settled' :
                 vm.payment.status === 'cancelled' ? 'Cancelled' :
                 vm.payment.status === 'reverse_payment' ? 'Reversed' :
                 'Pending'}
              </Text>
            </View>
            {vm.dueStatus && vm.payment.status === 'pending' && (
              <Text style={{ color: vm.dueStatus.style === 'overdue' ? '#dc2626' : vm.dueStatus.style === 'due-soon' ? '#d97706' : '#16a34a' }} className="text-xs font-semibold">
                {vm.dueStatus.text}
              </Text>
            )}
          </View>
        </View>

        {/* Invoice summary */}
        {vm.invoice && (
          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Invoice
            </Text>
            <Row label="Reference" value={vm.invoice.externalReference ?? vm.invoice.invoiceNumber ?? vm.invoice.id} />
            <Row label="Issued by" value={vm.invoice.issuerName ?? '—'} />
            <Row label="Issue date" value={formatDate(vm.invoice.dateIssued ?? vm.invoice.issueDate)} />
            <Row label="Due date" value={formatDate(vm.invoice.dateDue ?? vm.invoice.dueDate)} />
            <Row label="Total" value={formatCurrency(vm.invoice.total)} />
            <Row label="Payment status" value={vm.invoice.paymentStatus} />
            {vm.invoice.status === 'cancelled' && (
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
          <Row label="Category" value={vm.payment.paymentCategory ?? '—'} />
          <Row label="Stage" value={vm.payment.stageLabel ?? '—'} />
          <Row label="Due" value={formatDate(vm.payment.dueDate)} />
          <Row label="Method" value={vm.payment.method ?? '—'} />
          <Row label="Reference" value={vm.payment.reference ?? '—'} />
          {vm.payment.notes ? <Row label="Notes" value={vm.payment.notes} /> : null}

          {/* Project row — visible for both real and synthetic rows */}
          {vm.projectRowInteractive ? (
            <TouchableOpacity
              testID="project-row"
              onPress={() => vm.setProjectPickerVisible(true)}
              className="flex-row justify-between items-center py-1.5"
              activeOpacity={0.7}
            >
              <Text className="text-sm text-muted-foreground">Project</Text>
              <View className="flex-row items-center gap-1 flex-shrink ml-4">
                {vm.project ? (
                  <Text className="text-sm text-primary font-medium text-right" numberOfLines={1}>
                    {vm.project.name}
                  </Text>
                ) : (
                  <Text className="text-sm text-muted-foreground font-medium text-right">
                    Unassigned
                  </Text>
                )}
                <ChevronRight size={14} color={isDark ? '#a1a1aa' : '#71717a'} />
              </View>
            </TouchableOpacity>
          ) : (
            <View
              testID="project-row"
              className="flex-row justify-between items-center py-1.5"
            >
              <Text className="text-sm text-muted-foreground">Project</Text>
              <View className="flex-row items-center gap-1 flex-shrink ml-4">
                {vm.project ? (
                  <Text className="text-sm text-foreground font-medium text-right" numberOfLines={1}>
                    {vm.project.name}
                  </Text>
                ) : (
                  <Text className="text-sm text-muted-foreground font-medium text-right">
                    Unassigned
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Payment history for this invoice */}
        {vm.linkedPayments.length > 0 && (
          <View className="bg-card border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Payment History
            </Text>
            {vm.linkedPayments.map((p) => (
              <View key={p.id} className="flex-row items-center justify-between py-2 border-b border-border last:border-0">
                <View>
                  <Text className="text-sm text-foreground">{formatDate(p.date ?? p.updatedAt)}</Text>
                  <Text className="text-xs text-muted-foreground capitalize">{p.status}</Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">{formatCurrency(p.amount ?? 0)}</Text>
              </View>
            ))}
            {vm.totalSettled > 0 && (
              <View className="flex-row justify-between pt-2 mt-1">
                <Text className="text-sm font-semibold text-foreground">Total settled</Text>
                <Text className="text-sm font-semibold text-green-600">{formatCurrency(vm.totalSettled)}</Text>
              </View>
            )}
          </View>
        )}

        {/* CTAs */}
        {(vm.canRecordPayment || vm.showMarkAsPaidFallback) && (
          <View className="gap-3 mb-6">
            <TouchableOpacity
              onPress={vm.handleMarkAsPaid}
              disabled={vm.marking}
              className="bg-primary rounded-xl py-4 items-center"
              activeOpacity={0.8}
            >
              {vm.marking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-primary-foreground font-bold text-base">Mark as Paid</Text>
              )}
            </TouchableOpacity>

            {vm.canRecordPayment && (
              <TouchableOpacity
                onPress={vm.openPartialModal}
                className="border border-primary rounded-xl py-4 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-primary font-bold text-base">Make Partial Payment</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Project Picker Modal — #191 / #196 */}
      <ProjectPickerModal
        visible={vm.projectPickerVisible}
        currentProjectId={vm.resolvedProjectId}
        onSelect={vm.handleSelectProject}
        onNavigate={vm.handleNavigateToProject}
        onClose={() => vm.setProjectPickerVisible(false)}
      />

      {/* Pending Payment Form — #196 */}
      {vm.showEditIcon && (
        <PendingPaymentForm
          visible={vm.pendingFormVisible}
          payment={vm.payment}
          onClose={() => vm.setPendingFormVisible(false)}
          onSaved={async () => {
            vm.setPendingFormVisible(false);
            vm.reload();
          }}
        />
      )}

      {/* Partial Payment Modal */}
      <Modal
        visible={vm.partialModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={vm.closePartialModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50"
            activeOpacity={1}
            onPress={vm.closePartialModal}
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
                  <TouchableOpacity onPress={vm.closePartialModal}>
                    <X size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>

                {/* Invoice info */}
                {vm.invoice && (
                  <View className="mb-6">
                    <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
                      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Invoice</Text>
                      <Text className="text-base font-bold text-gray-900 dark:text-white mb-3">
                        {vm.invoice.externalReference ?? vm.invoice.invoiceNumber ?? vm.invoice.id}
                      </Text>
                      <View className="flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                        <View>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">Issued by</Text>
                          <Text className="text-sm font-medium text-gray-900 dark:text-white">{vm.invoice.issuerName ?? '—'}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xs text-gray-500 dark:text-gray-400">Due date</Text>
                          <Text className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(vm.invoice.dateDue ?? vm.invoice.dueDate)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row items-end justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                      <View>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Invoice</Text>
                        <Text className="text-base text-gray-400 dark:text-gray-500 line-through">
                          {formatCurrency(vm.invoice.total)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Remaining Balance</Text>
                        <Text className="text-xl font-bold text-primary">{formatCurrency(vm.remainingBalance)}</Text>
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
                      value={vm.partialAmount}
                      onChangeText={vm.setPartialAmount}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  {!!vm.partialAmountError && (
                    <Text className="text-xs text-red-500 mt-1">{vm.partialAmountError}</Text>
                  )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={vm.closePartialModal}
                    className="flex-1 py-3.5 rounded-xl border border-gray-300 dark:border-gray-600 items-center justify-center"
                  >
                    <Text className="font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={vm.handlePartialPaymentSubmit}
                    disabled={vm.submitting}
                    className="flex-1 py-3.5 rounded-xl bg-primary items-center justify-center"
                  >
                    {vm.submitting ? (
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

