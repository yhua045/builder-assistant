import React from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Invoice } from '../../../domain/entities/Invoice';

interface InvoiceLifecycleActionsProps {
  invoice: Invoice;
  onUpdate: (action: 'issue' | 'markPaid' | 'cancel', invoiceId: string) => void | Promise<void>;
  loading?: boolean;
}

export const InvoiceLifecycleActions: React.FC<InvoiceLifecycleActionsProps> = ({
  invoice,
  onUpdate,
  loading = false,
}) => {
  const handleIssue = () => {
    Alert.alert(
      'Issue Invoice',
      'Are you sure you want to issue this invoice?',
      [
        {
          text: 'Issue',
          onPress: () => onUpdate('issue', invoice.id),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleMarkPaid = () => {
    Alert.alert(
      'Mark Invoice as Paid',
      'Are you sure you want to mark this invoice as paid?',
      [
        {
          text: 'Mark Paid',
          onPress: () => onUpdate('markPaid', invoice.id),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Invoice',
      'Are you sure you want to cancel this invoice? This action cannot be undone.',
      [
        {
          text: 'Cancel Invoice',
          style: 'destructive',
          onPress: () => onUpdate('cancel', invoice.id),
        },
        {
          text: 'Go Back',
          style: 'cancel',
        },
      ]
    );
  };

  // Determine which actions to show based on invoice status
  const showIssue = invoice.status === 'draft';
  const showMarkPaid = invoice.status === 'issued' || invoice.status === 'overdue';
  const showCancel = 
    invoice.status === 'draft' || 
    invoice.status === 'issued' || 
    invoice.status === 'overdue';

  // Don't render anything if no actions are available
  if (!showIssue && !showMarkPaid && !showCancel) {
    return null;
  }

  return (
    <View className="flex-row flex-wrap gap-2 p-4">
      {showIssue && (
        <TouchableOpacity
          className={`py-2.5 px-4 rounded-lg min-w-[100px] items-center justify-center bg-blue-500 ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleIssue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-sm">Issue</Text>
          )}
        </TouchableOpacity>
      )}

      {showMarkPaid && (
        <TouchableOpacity
          className={`py-2.5 px-4 rounded-lg min-w-[100px] items-center justify-center bg-green-500 ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleMarkPaid}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-sm">Mark Paid</Text>
          )}
        </TouchableOpacity>
      )}

      {showCancel && (
        <TouchableOpacity
          className={`py-2.5 px-4 rounded-lg min-w-[100px] items-center justify-center bg-red-500 ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleCancel}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-sm">Cancel</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};
