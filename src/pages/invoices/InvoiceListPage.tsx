import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { FileText, DollarSign, Eye, Edit, Trash2 } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';
import { useInvoices } from '../../hooks/useInvoices';
import type { Invoice } from '../../domain/entities/Invoice';

cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Eye, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Edit, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type FilterStatus = Invoice['status'] | 'all';

export default function InvoiceListPage() {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { invoices, loading, error, deleteInvoice, refreshInvoices } = useInvoices();

  // Filter invoices by active filter
  const filteredInvoices = useMemo(() => {
    if (activeFilter === 'all') return invoices;
    return invoices.filter(inv => inv.status === activeFilter);
  }, [invoices, activeFilter]);

  // Calculate metrics
  const totalCount = invoices.length;
  const totalUnpaid = useMemo(() => {
    return invoices
      .filter(inv => inv.paymentStatus === 'unpaid')
      .reduce((sum, inv) => sum + inv.total, 0);
  }, [invoices]);

  const getStatusConfig = (status: Invoice['status']) => {
    switch (status) {
      case 'draft':
        return {
          label: 'Draft',
          bgClass: 'bg-gray-100 dark:bg-gray-800',
          textClass: 'text-gray-700 dark:text-gray-300',
        };
      case 'issued':
        return {
          label: 'Issued',
          bgClass: 'bg-blue-100 dark:bg-blue-950',
          textClass: 'text-blue-700 dark:text-blue-400',
        };
      case 'paid':
        return {
          label: 'Paid',
          bgClass: 'bg-green-100 dark:bg-green-950',
          textClass: 'text-green-700 dark:text-green-400',
        };
      case 'overdue':
        return {
          label: 'Overdue',
          bgClass: 'bg-red-100 dark:bg-red-950',
          textClass: 'text-red-700 dark:text-red-400',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bgClass: 'bg-gray-100 dark:bg-gray-800',
          textClass: 'text-gray-500 dark:text-gray-400',
        };
      default:
        return {
          label: 'Unknown',
          bgClass: 'bg-gray-100 dark:bg-gray-800',
          textClass: 'text-gray-700 dark:text-gray-300',
        };
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDelete = async (id: string) => {
    await deleteInvoice(id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshInvoices();
    setRefreshing(false);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
    >
      {/* Header */}
      <View className="px-6 py-4 border-b border-border">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <FileText className="text-primary mr-3" size={24} />
            <Text className="text-2xl font-bold text-foreground">Invoices</Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-card rounded-xl p-4 border border-border">
            <View className="flex-row items-center gap-2 mb-1">
              <FileText className="text-primary" size={18} />
              <Text className="text-xs font-medium text-muted-foreground">Total Invoices</Text>
            </View>
            <Text className="text-xl font-bold text-foreground">{totalCount}</Text>
          </View>

          <View className="flex-1 bg-card rounded-xl p-4 border border-border">
            <View className="flex-row items-center gap-2 mb-1">
              <DollarSign className="text-amber-500" size={18} />
              <Text className="text-xs font-medium text-muted-foreground">Unpaid</Text>
            </View>
            <Text className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalUnpaid)}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="px-6 py-4 border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['all', 'draft', 'issued', 'paid', 'overdue', 'cancelled'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              testID={`filter-${filter}`}
              onPress={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full border ${
                activeFilter === filter
                  ? 'bg-primary border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeFilter === filter
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Loading State */}
      {loading && (
        <View className="px-6 py-8">
          <ActivityIndicator testID="invoices-loading" size="large" />
        </View>
      )}

      {/* Error State */}
      {error && (
        <View className="px-6 py-8">
          <Text testID="invoices-error" className="text-destructive">{error}</Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && !error && filteredInvoices.length === 0 && (
        <View className="px-6 py-8">
          <Text testID="invoices-empty" className="text-muted-foreground text-center">
            {activeFilter === 'all' ? 'No invoices yet' : `No ${activeFilter} invoices`}
          </Text>
        </View>
      )}

      {/* Invoice List */}
      {!loading && !error && filteredInvoices.length > 0 && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 128 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View className="px-6 gap-3">
            {filteredInvoices.map((invoice) => {
              const statusConfig = getStatusConfig(invoice.status);
              
              return (
                <View
                  key={invoice.id}
                  testID={`invoice-item-${invoice.id}`}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  {/* Header Row */}
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-foreground mb-1">
                        {invoice.invoiceNumber || invoice.id}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {invoice.vendor || 'Unknown Vendor'}
                      </Text>
                    </View>
                    <View
                      testID={`status-badge-${invoice.status}`}
                      className={`px-3 py-1 rounded-full ${statusConfig.bgClass}`}
                    >
                      <Text className={`text-xs font-medium ${statusConfig.textClass}`}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  {/* Details Row */}
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text className="text-xs text-muted-foreground mb-1">Amount</Text>
                      <Text className="text-base font-semibold text-foreground">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-muted-foreground mb-1">Due Date</Text>
                      <Text className="text-sm text-foreground">
                        {formatDate(invoice.dueDate)}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-2 pt-3 border-t border-border">
                    <TouchableOpacity
                      testID={`action-view-${invoice.id}`}
                      className="flex-1 flex-row items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary"
                      onPress={() => {
                        // TODO: Navigate to detail page
                      }}
                    >
                      <Eye className="text-secondary-foreground" size={16} />
                      <Text className="text-sm font-medium text-secondary-foreground">View</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID={`action-edit-${invoice.id}`}
                      className="flex-1 flex-row items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary"
                      onPress={() => {
                        // TODO: Navigate to edit page
                      }}
                    >
                      <Edit className="text-secondary-foreground" size={16} />
                      <Text className="text-sm font-medium text-secondary-foreground">Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID={`action-delete-${invoice.id}`}
                      className="px-3 py-2 rounded-lg bg-destructive/10"
                      onPress={() => handleDelete(invoice.id)}
                    >
                      <Trash2 className="text-destructive" size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
