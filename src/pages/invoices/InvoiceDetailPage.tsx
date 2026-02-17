import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useInvoices } from '../../hooks/useInvoices';
import InvoiceForm from '../../components/invoices/InvoiceForm';
import type { Invoice } from '../../domain/entities/Invoice';

cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Edit, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function InvoiceDetailPage() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const navigation = useNavigation();
  const route = useRoute();
  const { invoiceId } = (route.params as any) || {};

  const { getInvoiceById, updateInvoice, deleteInvoice } = useInvoices();

  // loadInvoice intentionally omitted from deps to avoid recreating the
  // function on every render; invoiceId is the primary driver.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadInvoice = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInvoiceById(invoiceId);
      setInvoice(data);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, getInvoiceById]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleUpdate = async (updatedInvoice: Partial<Invoice>) => {
    const result = await updateInvoice({ ...invoice, ...updatedInvoice } as Invoice);
    if (result.success) {
      setIsEditing(false);
      await loadInvoice(); // Refresh data
    }
  };

  const handleDelete = async () => {
    const result = await deleteInvoice(invoiceId);
    if (result.success) {
      navigation.goBack();
    }
  };

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

  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="invoice-loading" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
      >
        <View className="flex-1 items-center justify-center px-6">
          <Text testID="invoice-not-found" className="text-lg text-muted-foreground">
            Invoice not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isEditing) {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
      >
        <InvoiceForm
          mode="edit"
          initialValues={invoice}
          onUpdate={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={false}
        />
      </SafeAreaView>
    );
  }

  const statusConfig = getStatusConfig(invoice.status);

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
    >
      {/* Header */}
      <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
        <TouchableOpacity
          testID="back-button"
          onPress={() => navigation.goBack()}
          className="mr-4"
        >
          <ArrowLeft className="text-foreground" size={24} />
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">{invoice.invoiceNumber || invoice.id}</Text>
          <Text className="text-sm text-muted-foreground">{invoice.vendor || 'Unknown Vendor'}</Text>
        </View>

        <View
          testID="status-badge"
          className={`px-3 py-1 rounded-full ${statusConfig.bgClass}`}
        >
          <Text className={`text-xs font-medium ${statusConfig.textClass}`}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        <View className="px-6 py-4 gap-4">
          {/* Amount Section */}
          <View className="bg-card rounded-xl p-4 border border-border">
            <Text className="text-sm font-medium text-muted-foreground mb-3">Invoice Amount</Text>
            
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">Subtotal</Text>
                <Text className="text-sm font-medium text-foreground">
                  {formatCurrency(invoice.subtotal || invoice.total, invoice.currency)}
                </Text>
              </View>

              {invoice.tax !== undefined && invoice.tax > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Tax</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {formatCurrency(invoice.tax, invoice.currency)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between pt-2 border-t border-border">
                <Text className="text-base font-semibold text-foreground">Total</Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatCurrency(invoice.total, invoice.currency)}
                </Text>
              </View>
            </View>
          </View>

          {/* Dates Section */}
          <View className="bg-card rounded-xl p-4 border border-border">
            <Text className="text-sm font-medium text-muted-foreground mb-3">Dates</Text>
            
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">Issue Date</Text>
                <Text className="text-sm font-medium text-foreground">
                  {formatDate(invoice.issueDate)}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">Due Date</Text>
                <Text className="text-sm font-medium text-foreground">
                  {formatDate(invoice.dueDate)}
                </Text>
              </View>
            </View>
          </View>

          {/* Line Items Section */}
          {invoice.lineItems && invoice.lineItems.length > 0 && (
            <View className="bg-card rounded-xl p-4 border border-border">
              <Text className="text-sm font-medium text-muted-foreground mb-3">Line Items</Text>
              
              <View className="gap-3">
                {invoice.lineItems.map((item, index) => {
                  const lineTotal =
                    item.amount ??
                    item.total ??
                    (item.unitPrice ?? item.unitCost ?? 0) * (item.quantity ?? 1);

                  return (
                    <View key={index} className="pb-2 border-b border-border last:border-b-0 last:pb-0">
                      <Text className="text-sm font-medium text-foreground mb-1">
                        {item.description}
                      </Text>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unitPrice || 0, invoice.currency)}
                        </Text>
                        <Text className="text-sm font-medium text-foreground">
                          {formatCurrency(lineTotal, invoice.currency)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Notes Section */}
          {invoice.notes && (
            <View className="bg-card rounded-xl p-4 border border-border">
              <Text className="text-sm font-medium text-muted-foreground mb-2">Notes</Text>
              <Text className="text-sm text-foreground">{invoice.notes}</Text>
            </View>
          )}

          {/* Additional Info */}
          <View className="bg-card rounded-xl p-4 border border-border">
            <Text className="text-sm font-medium text-muted-foreground mb-3">Additional Information</Text>
            
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">Payment Status</Text>
                <Text className="text-sm font-medium text-foreground capitalize">
                  {invoice.paymentStatus || 'unpaid'}
                </Text>
              </View>

              {invoice.projectId && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Project</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {invoice.projectId}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              testID="action-edit"
              className="flex-1 flex-row items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary"
              onPress={() => setIsEditing(true)}
            >
              <Edit className="text-primary-foreground" size={18} />
              <Text className="text-sm font-medium text-primary-foreground">Edit Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="action-delete"
              className="px-4 py-3 rounded-lg bg-destructive"
              onPress={handleDelete}
            >
              <Trash2 className="text-destructive-foreground" size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
