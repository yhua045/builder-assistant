import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { AlertCircle, Calendar, DollarSign, Filter, CheckCircle, Clock } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';

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

const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'p1',
    vendor: 'ABC Construction Co.',
    vendorImage: 'https://images.unsplash.com/photo-1600249324369-cf81f82f441b?w=900&auto=format&fit=crop&q=60',
    project: 'Downtown Plaza',
    amount: 15750,
    dueDate: '2024-01-18',
    status: 'overdue',
    invoiceNumber: 'INV-2024-001',
    description: 'Phase 2 Construction Materials',
  },
  {
    id: 'p2',
    vendor: 'Elite Electrical Services',
    vendorImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=900&auto=format&fit=crop&q=60',
    project: 'Riverside Complex',
    amount: 8200,
    dueDate: '2024-01-22',
    status: 'upcoming',
    invoiceNumber: 'INV-2024-002',
    description: 'Electrical Wiring & Installation',
  },
  {
    id: 'p3',
    vendor: 'ProPlumbing Solutions',
    vendorImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&auto=format&fit=crop&q=60',
    project: 'Sunset Apartments',
    amount: 12500,
    dueDate: '2024-01-25',
    status: 'upcoming',
    invoiceNumber: 'INV-2024-003',
    description: 'Plumbing System Upgrade',
  },
  {
    id: 'p4',
    vendor: 'GreenScape Landscaping',
    vendorImage: 'https://images.unsplash.com/photo-1600249324369-cf81f82f441b?w=900&auto=format&fit=crop&q=60',
    project: 'Downtown Plaza',
    amount: 5600,
    dueDate: '2024-01-15',
    status: 'paid',
    invoiceNumber: 'INV-2024-004',
    description: 'Landscaping & Garden Design',
  },
  {
    id: 'p5',
    vendor: 'TechSecurity Systems',
    vendorImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=900&auto=format&fit=crop&q=60',
    project: 'Riverside Complex',
    amount: 9800,
    dueDate: '2024-01-28',
    status: 'upcoming',
    invoiceNumber: 'INV-2024-005',
    description: 'Security System Installation',
  },
  {
    id: 'p6',
    vendor: 'Premium Paint Co.',
    vendorImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&auto=format&fit=crop&q=60',
    project: 'Sunset Apartments',
    amount: 4200,
    dueDate: '2024-01-12',
    status: 'paid',
    invoiceNumber: 'INV-2024-006',
    description: 'Interior & Exterior Painting',
  },
];

export default function PaymentsScreen() {
  const [activeFilter, setActiveFilter] = useState<PaymentStatus | 'all'>('all');

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const filteredPayments = activeFilter === 'all' 
    ? MOCK_PAYMENTS 
    : MOCK_PAYMENTS.filter(p => p.status === activeFilter);

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

  const totalPending = MOCK_PAYMENTS
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const overdueCount = MOCK_PAYMENTS.filter(p => p.status === 'overdue').length;

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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 128, gap: 12, paddingTop: 16 }}>
        {filteredPayments.length === 0 ? (
          <View className="items-center py-12">
            <Filter className="text-muted-foreground mb-3" size={48} />
            <Text className="text-lg font-semibold text-foreground">No payments found</Text>
            <Text className="text-muted-foreground text-center mt-1">
              Try adjusting your filter selection
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