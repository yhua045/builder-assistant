import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
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

  return (
    <ScrollView 
      contentContainerStyle={{ gap: 16 }}
      testID="invoice-form"
    >
      {/* PDF File Indicator */}
      {pdfFile && (
        <View className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex-col gap-1">
          <Text className="text-sm font-bold text-blue-900">📄 PDF Attached</Text>
          <Text className="text-xs text-blue-800" numberOfLines={1} ellipsizeMode="middle">{pdfFile.name}</Text>
          <Text className="text-[10px] text-blue-600">
            {(pdfFile.size / 1024).toFixed(1)} KB
          </Text>
        </View>
      )}

      <View className="bg-white p-4 rounded-xl border border-zinc-200 gap-4 mb-4 shadow-sm">
        <Text className="text-lg font-bold text-zinc-900 mb-2">Invoice Details</Text>

        {/* Invoice Number */}
        <View className="gap-2 mb-4">
          <Text className="text-sm font-semibold text-zinc-700">Invoice Number</Text>
          <TextInput
            className="border border-zinc-300 rounded-lg p-3 text-base text-zinc-900 bg-white"
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            placeholder="Auto-generated if left blank"
            testID="invoice-form-number-input"
          />
        </View>

        {/* Vendor */}
        <View className="gap-2 mb-4">
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
        <View className="gap-2 mb-4">
          <Text className="text-sm font-semibold text-zinc-700">Total *</Text>
          <TextInput
            className={`border rounded-lg p-3 text-base bg-white ${
              errors.total ? 'border-red-500' : 'border-zinc-300'
            }`}
            value={total}
            onChangeText={setTotal}
            placeholder="Total amount"
            keyboardType="numeric"
            testID="invoice-form-total-input"
          />
          {errors.total && (
            <Text className="text-red-500 text-xs mt-1" testID="invoice-form-total-error">
              {errors.total}
            </Text>
          )}
        </View>

        {/* Date Issued */}
        <View className="gap-2 mb-4">
          <DatePickerInput
            label="Invoice Date"
            value={dateIssued}
            onChange={setDateIssued}
          />
        </View>

        {/* Date Due */}
        <View className="gap-2 mb-4">
          <DatePickerInput
            label="Due Date"
            value={dateDue}
            onChange={setDateDue}
          />
          {errors.dates && (
            <Text className="text-red-500 text-xs mt-1" testID="invoice-form-dates-error">
              {errors.dates}
            </Text>
          )}
        </View>

        {/* Notes */}
        <View className="gap-2 mb-4">
          <Text className="text-sm font-semibold text-zinc-700">Notes</Text>
          <TextInput
            className="border border-zinc-300 rounded-lg p-3 text-base bg-white min-h-[100px]"
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            testID="invoice-form-notes-input"
          />
        </View>

        {/* Line Items Error */}
        {errors.lineItems && (
          <Text className="text-red-500 text-xs mt-1" testID="invoice-form-lineitems-error">
            {errors.lineItems}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-between gap-4 mb-8">
        <Pressable
          className="flex-1 p-4 rounded-lg items-center bg-zinc-100"
          onPress={onCancel}
          testID="invoice-form-cancel-button"
        >
          <Text className="text-zinc-600 text-base font-semibold">Cancel</Text>
        </Pressable>

        <Pressable
          className={`flex-1 p-4 rounded-lg items-center ${
            isLoading ? 'bg-zinc-400' : 'bg-blue-600'
          }`}
          onPress={handleSubmit}
          disabled={isLoading}
          testID="invoice-form-save-button"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">
              {mode === 'create' ? 'Create Invoice' : 'Update Invoice'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
};
