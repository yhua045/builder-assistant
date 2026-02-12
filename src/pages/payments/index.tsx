import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { AlertCircle, Calendar, DollarSign, Filter, CheckCircle, Clock } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';
import { usePayments } from '../../hooks/usePayments';
import type { Payment as PaymentEntity } from '../../domain/entities/Payment';

cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Filter, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type PaymentStatus = 'overdue' | 'upcoming' | 'paid';

type Payment = {
  id: string;
  vendor: string;
  vendorImage: string;
  project: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  invoiceNumber: string;
  description: string;
};

// Helper to map PaymentEntity to UI Payment format
const mapPaymentEntityToUI = (entity: PaymentEntity, status: PaymentStatus): Payment => {
  return {
    id: entity.id,
    vendor: entity.contactId || 'Unknown Vendor',
    vendorImage: 'https://images.unsplash.com/photo-1600249324369-cf81f82f441b?w=900&auto=format&fit=crop&q=60',
    project: entity.projectId || 'Unassigned',
    amount: entity.amount,
    dueDate: entity.dueDate || entity.date || new Date().toISOString(),
    status,
    invoiceNumber: entity.invoiceId || 'N/A',
    description: `Payment for ${entity.invoiceId || 'invoice'}`,
  };
};

export default function PaymentsScreen() {
  const [activeFilter, setActiveFilter] = useState<PaymentStatus | 'all'>('all');

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { overdue, upcoming, paid, metrics, loading, refresh } = usePayments();

  // Combine all payments with their status
  const allPayments = useMemo(() => [
    ...overdue.map(p => mapPaymentEntityToUI(p, 'overdue')),
    ...upcoming.map(p => mapPaymentEntityToUI(p, 'upcoming')),
    ...paid.map(p => mapPaymentEntityToUI(p, 'paid')),
  ], [overdue, upcoming, paid]);

  const filteredPayments = activeFilter === 'all' 
    ? allPayments 
    : allPayments.filter(p => p.status === activeFilter);

  const getStatusConfig = (status: PaymentStatus) => {
    switch (status) {
      case 'overdue':
        return {
          label: 'Overdue',
          bgClass: 'bg-red-100 dark:bg-red-950',
          textClass: 'text-red-700 dark:text-red-400',
          icon: AlertCircle,
          iconColor: '#ef4444',
        };
      case 'upcoming':
        return {
          label: 'Upcoming',
          bgClass: 'bg-amber-100 dark:bg-amber-950',
          textClass: 'text-amber-700 dark:text-amber-400',
          icon: Clock,
          iconColor: '#f59e0b',
        };
      case 'paid':
        return {
          label: 'Paid',
          bgClass: 'bg-emerald-100 dark:bg-emerald-950',
          textClass: 'text-emerald-700 dark:text-emerald-400',
          icon: CheckCircle,
          iconColor: '#10b981',
        };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalPending = metrics.pendingTotalNext7Days || 0;
  const overdueCount = metrics.overdueCount || 0;

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
    >
      {/* Header */}
      <View className="px-6 py-4 border-b border-border">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-foreground">Payments</Text>
          <ThemeToggle />
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-card rounded-xl p-4 border border-border">
            <View className="flex-row items-center gap-2 mb-1">
              <DollarSign className="text-primary" size={18} />
              <Text className="text-xs font-medium text-muted-foreground">Total Pending</Text>
            </View>
            <Text className="text-xl font-bold text-foreground">{formatCurrency(totalPending)}</Text>
          </View>

          <View className="flex-1 bg-card rounded-xl p-4 border border-border">
            <View className="flex-row items-center gap-2 mb-1">
              <AlertCircle className="text-red-500" size={18} />
              <Text className="text-xs font-medium text-muted-foreground">Overdue</Text>
            </View>
            <Text className="text-xl font-bold text-red-600 dark:text-red-400">{overdueCount}</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="px-6 py-4 border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['all', 'overdue', 'upcoming', 'paid'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full border ${
                activeFilter === filter
                  ? 'bg-primary border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`font-semibold capitalize ${
                  activeFilter === filter
                    ? 'text-primary-foreground'
                    : 'text-foreground'
                }`}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Payments List */}
      <ScrollView 
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 128, gap: 12, paddingTop: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={isDark ? '#fff' : '#000'}
          />
        }
      >
        {loading && allPayments.length === 0 ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
            <Text className="text-muted-foreground mt-4">Loading payments...</Text>
          </View>
        ) : filteredPayments.length === 0 ? (
          <View className="items-center py-12">
            <Filter className="text-muted-foreground mb-3" size={48} />
            <Text className="text-lg font-semibold text-foreground">
              {activeFilter === 'all' ? 'No payments yet' : `No ${activeFilter} payments`}
            </Text>
            <Text className="text-muted-foreground text-center mt-1">
              {activeFilter === 'all' 
                ? 'Payments will appear here when added'
                : activeFilter === 'overdue'
                ? 'No overdue payments at the moment'
                : activeFilter === 'upcoming'
                ? 'No upcoming payments scheduled'
                : 'No paid payments in the last 7 days'
              }
            </Text>
          </View>
        ) : (
          filteredPayments.map((payment) => {
            const statusConfig = getStatusConfig(payment.status);
            const StatusIcon = statusConfig.icon;

            return (
              <TouchableOpacity
                key={payment.id}
                className="bg-card rounded-xl border border-border overflow-hidden"
                activeOpacity={0.7}
              >
                <View className="p-4">
                  {/* Vendor Header */}
                  <View className="flex-row items-center gap-3 mb-3">
                    <Image
                      source={{ uri: payment.vendorImage }}
                      className="w-12 h-12 rounded-full"
                    />
                    <View className="flex-1">
                      <Text className="text-base font-bold text-foreground">{payment.vendor}</Text>
                      <Text className="text-sm text-muted-foreground">{payment.project}</Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full ${statusConfig.bgClass}`}>
                      <Text className={`text-xs font-semibold ${statusConfig.textClass}`}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text className="text-sm text-muted-foreground mb-3">{payment.description}</Text>

                  {/* Details Row */}
                  <View className="flex-row items-center justify-between pt-3 border-t border-border">
                    <View>
                      <Text className="text-xs text-muted-foreground mb-1">Invoice</Text>
                      <Text className="text-sm font-semibold text-foreground">{payment.invoiceNumber}</Text>
                    </View>

                    <View className="items-center">
                      <View className="flex-row items-center gap-1 mb-1">
                        <Calendar className="text-muted-foreground" size={12} />
                        <Text className="text-xs text-muted-foreground">Due Date</Text>
                      </View>
                      <Text className="text-sm font-semibold text-foreground">{formatDate(payment.dueDate)}</Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-xs text-muted-foreground mb-1">Amount</Text>
                      <Text className="text-lg font-bold text-primary">{formatCurrency(payment.amount)}</Text>
                    </View>
                  </View>
                </View>

                {/* Action Footer */}
                {payment.status !== 'paid' && (
                  <View className="bg-muted px-4 py-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <StatusIcon color={statusConfig.iconColor} size={16} />
                      <Text className="text-sm font-medium text-foreground">
                        {payment.status === 'overdue' ? 'Payment overdue' : 'Payment scheduled'}
                      </Text>
                    </View>
                    <TouchableOpacity className="bg-primary px-4 py-2 rounded-lg">
                      <Text className="text-primary-foreground font-semibold text-sm">Pay Now</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}