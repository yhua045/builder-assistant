import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Invoice, InvoiceLineItem } from '../../../domain/entities/Invoice';
import DatePickerInput from '../../../components/inputs/DatePickerInput';
import { ContractorLookupField } from '../../../components/inputs/ContractorLookupField';
import { PdfFileMetadata } from '../../../types/PdfFileMetadata';

export interface InvoiceFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<Invoice>;
  onCreate?: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate?: (invoice: Invoice) => void;
  onCancel: () => void;
  isLoading?: boolean;
  pdfFile?: PdfFileMetadata; // Optional PDF file metadata (for upload flow)
  /** When true the form is rendered embedded inside another screen and should use compact padding */
  embedded?: boolean;
}

interface FormErrors {
  total?: string;
  currency?: string;
  vendor?: string;
  status?: string;
  paymentStatus?: string;
  dates?: string;
  lineItems?: string;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  mode,
  initialValues,
  onCreate,
  onUpdate,
  onCancel,
  isLoading = false,
  pdfFile,
  embedded = false,
}) => {
  // Core fields
  const [invoiceNumber, setInvoiceNumber] = useState(initialValues?.externalReference || '');
  const [vendor, setVendor] = useState(initialValues?.issuerName || '');
  const [vendorId, setVendorId] = useState(initialValues?.issuerId || '');
  const [total, setTotal] = useState(initialValues?.total?.toString() || '');
  // Default currency to AUD
  const [currency, _setCurrency] = useState(initialValues?.currency || 'AUD');
  const [subtotal, setSubtotal] = useState(initialValues?.subtotal?.toString() || '');
  const [tax, _setTax] = useState(initialValues?.tax?.toString() || '');
  const [status, _setStatus] = useState<Invoice['status']>(initialValues?.status || 'draft');
  const [paymentStatus, _setPaymentStatus] = useState<Invoice['paymentStatus']>(
    initialValues?.paymentStatus || 'unpaid'
  );
  const [dateIssued, setDateIssued] = useState<Date | null>(
    initialValues?.dateIssued ? new Date(initialValues.dateIssued) : new Date()
  );
  const [dateDue, setDateDue] = useState<Date | null>(
    initialValues?.dateDue ? new Date(initialValues.dateDue) : null
  );
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [lineItems, _setLineItems] = useState<InvoiceLineItem[]>(
    initialValues?.lineItems || []
  );

  const [errors, setErrors] = useState<FormErrors>({});

  // Calculate subtotal from line items
  useEffect(() => {
    if (lineItems.length > 0) {
      const calculatedSubtotal = lineItems.reduce((acc, item) => {
        const qty = item.quantity || 1;
        const unit = item.unitCost || 0;
        const itemTotal = item.total || qty * unit;
        return acc + itemTotal;
      }, 0);
      setSubtotal(calculatedSubtotal.toString());
    }
  }, [lineItems]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!vendor.trim() || !vendorId.trim()) {
      newErrors.vendor = 'Please select a vendor';
    }

    // Required: total
    const totalNum = parseFloat(total);
    if (!total || isNaN(totalNum)) {
      newErrors.total = 'Total is required';
    } else if (totalNum < 0) {
      newErrors.total = 'Total must be non-negative';
    }

    // Required: currency
    if (!currency.trim()) {
      newErrors.currency = 'Currency is required';
    }

    // Validate dates: due date >= issue date
    if (dateIssued && dateDue) {
      if (dateDue < dateIssued) {
        newErrors.dates = 'Due date must be on or after issue date';
      }
    }

    // Validate line items subtotal and total
    if (lineItems.length > 0) {
      const calculatedSubtotal = lineItems.reduce((acc, item) => {
        const qty = item.quantity || 1;
        const unit = item.unitCost || 0;
        const itemTotal = item.total || qty * unit;
        return acc + itemTotal;
      }, 0);

      const subtotalNum = subtotal ? parseFloat(subtotal) : 0;
      const taxNum = tax ? parseFloat(tax) : 0;
      
      const tolerance = 0.01;
      
      // Check if subtotal matches calculated line items sum
      if (subtotal && Math.abs(calculatedSubtotal - subtotalNum) > tolerance) {
        newErrors.lineItems = 'Subtotal does not match sum of line items';
      }
      
      // Check if total matches subtotal + tax, OR matches line items sum if no separate subtotal
      const totalNum = parseFloat(total);
      const expectedTotal = subtotal ? subtotalNum + taxNum : calculatedSubtotal + taxNum;
      if (!isNaN(totalNum) && Math.abs(totalNum - expectedTotal) > tolerance) {
        newErrors.total = newErrors.total || 'Total does not match line items and tax';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    const invoiceData: any = {
      externalReference: invoiceNumber.trim() || undefined,
      issuerName: vendor.trim() || undefined,
      issuerId: vendorId.trim() || undefined,
      total: parseFloat(total),
      currency: currency.trim(),
      subtotal: subtotal ? parseFloat(subtotal) : undefined,
      tax: tax ? parseFloat(tax) : undefined,
      status,
      paymentStatus,
      dateIssued: dateIssued ? dateIssued.toISOString() : undefined,
      dateDue: dateDue ? dateDue.toISOString() : undefined,
      notes: notes.trim() || undefined,
      lineItems: lineItems.length > 0 ? lineItems : undefined,
    };

    if (mode === 'create' && onCreate) {
      onCreate(invoiceData);
    } else if (mode === 'edit' && onUpdate && initialValues?.id) {
      onUpdate({
        ...invoiceData,
        id: initialValues.id,
        createdAt: initialValues.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const containerStyle = embedded ? styles.containerEmbedded : styles.container;

  return (
    <ScrollView style={containerStyle} testID="invoice-form">
      {/* PDF File Indicator */}
      {pdfFile && (
        <View style={styles.pdfIndicator}>
          <Text style={styles.pdfIndicatorTitle}>📄 PDF Attached</Text>
          <Text style={styles.pdfIndicatorText}>{pdfFile.name}</Text>
          <Text style={styles.pdfIndicatorSize}>
            {(pdfFile.size / 1024).toFixed(1)} KB
          </Text>
        </View>
      )}

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Invoice Details</Text>

        {/* Invoice Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Invoice Number</Text>
          <TextInput
            style={styles.input}
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            placeholder="Auto-generated if left blank"
            testID="invoice-form-number-input"
          />
        </View>

        {/* Vendor */}
        <View style={styles.fieldGroup}>
          <ContractorLookupField
            label="Vendor/Issuer *"
            value={vendor}
            onChange={(val, id) => {
              setVendor(val);
              if (id) setVendorId(id);
            }}
            placeholder="Vendor name"
            error={errors.vendor}
          />
        </View>

        {/* Total */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Total *</Text>
          <TextInput
            style={[styles.input, errors.total && styles.inputError]}
            value={total}
            onChangeText={setTotal}
            placeholder="Total amount"
            keyboardType="numeric"
            testID="invoice-form-total-input"
          />
          {errors.total && (
            <Text style={styles.errorText} testID="invoice-form-total-error">
              {errors.total}
            </Text>
          )}
        </View>

        {/* Date Issued */}
        <View style={styles.fieldGroup}>
          <DatePickerInput
            label="Invoice Date"
            value={dateIssued}
            onChange={setDateIssued}
          />
        </View>

        {/* Date Due */}
        <View style={styles.fieldGroup}>
          <DatePickerInput
            label="Due Date"
            value={dateDue}
            onChange={setDateDue}
          />
          {errors.dates && (
            <Text style={styles.errorText} testID="invoice-form-dates-error">
              {errors.dates}
            </Text>
          )}
        </View>

        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes"
            multiline
            numberOfLines={4}
            testID="invoice-form-notes-input"
          />
        </View>

        {/* Line Items Error */}
        {errors.lineItems && (
          <Text style={styles.errorText} testID="invoice-form-lineitems-error">
            {errors.lineItems}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          testID="invoice-form-cancel-button"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[
            styles.button,
            styles.saveButton,
            isLoading && styles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
          testID="invoice-form-save-button"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {mode === 'create' ? 'Create Invoice' : 'Update Invoice'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  containerEmbedded: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  pdfIndicator: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#0ea5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  pdfIndicatorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 4,
  },
  pdfIndicatorText: {
    fontSize: 14,
    color: '#075985',
    marginBottom: 2,
  },
  pdfIndicatorSize: {
    fontSize: 12,
    color: '#0c4a6e',
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
});
