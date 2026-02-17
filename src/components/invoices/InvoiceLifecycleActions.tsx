import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Invoice } from '../../domain/entities/Invoice';

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
    <View style={styles.container}>
      {showIssue && (
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleIssue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Issue</Text>
          )}
        </TouchableOpacity>
      )}

      {showMarkPaid && (
        <TouchableOpacity
          style={[styles.button, styles.successButton, loading && styles.disabledButton]}
          onPress={handleMarkPaid}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.successButtonText}>Mark Paid</Text>
          )}
        </TouchableOpacity>
      )}

      {showCancel && (
        <TouchableOpacity
          style={[styles.button, styles.dangerButton, loading && styles.disabledButton]}
          onPress={handleCancel}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerButtonText}>Cancel</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6', // blue-500
  },
  successButton: {
    backgroundColor: '#22c55e', // green-500
  },
  dangerButton: {
    backgroundColor: '#ef4444', // red-500
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  successButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  dangerButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
