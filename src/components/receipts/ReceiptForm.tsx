import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SnapReceiptDTO } from '../../application/usecases/receipt/SnapReceiptUseCase';
import { NormalizedReceipt } from '../../application/receipt/IReceiptNormalizer';
import DatePickerInput from '../inputs/DatePickerInput';
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react-native';
import OptionList from '../inputs/OptionList';

import { ContractorLookupField } from '../inputs/ContractorLookupField';

interface ReceiptFormProps {
  initialValues?: Partial<SnapReceiptDTO>;
  normalizedData?: NormalizedReceipt;  // OCR-extracted data with confidence
  onSubmit: (data: SnapReceiptDTO) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isProcessing?: boolean;  // OCR is running
}

const PAYMENT_METHODS = [
  { label: 'Card', value: 'card' },
  { label: 'Cash', value: 'cash' },
  { label: 'Bank', value: 'bank' },
  { label: 'Other', value: 'other' },
];

export const ReceiptForm: React.FC<ReceiptFormProps> = ({ 
  initialValues, 
  normalizedData, 
  onSubmit, 
  onCancel, 
  isLoading,
  isProcessing 
}) => {
  const [vendor, setVendor] = useState(initialValues?.vendor || '');
  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState(initialValues?.amount?.toString() || '');
  const [date, setDate] = useState<Date | null>(initialValues?.date ? new Date(initialValues.date) : new Date());
  const [paymentMethod, setPaymentMethod] = useState<string>(initialValues?.paymentMethod || 'card');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when normalized data arrives from OCR
  useEffect(() => {
    if (normalizedData) {
      if (normalizedData.vendor) setVendor(normalizedData.vendor);
      if (normalizedData.total) setAmount(normalizedData.total.toString());
      if (normalizedData.date) setDate(normalizedData.date);
      if (normalizedData.suggestedCorrections.length > 0) {
        setNotes(prev => {
          const corrections = `OCR Notes: ${normalizedData.suggestedCorrections.join(', ')}`;
          return prev ? `${corrections}\n${prev}` : corrections;
        });
      }
    }
  }, [normalizedData]);

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) {
      return <CheckCircle size={16} color="#10b981" />;
    } else if (confidence >= 0.5) {
      return <AlertTriangle size={16} color="#f59e0b" />;
    } else {
      return <AlertCircle size={16} color="#ef4444" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'border-green-500';
    if (confidence >= 0.5) return 'border-yellow-500';
    return 'border-red-500';
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!vendor.trim()) newErrors.vendor = 'Vendor is required';
    if (!vendorId.trim()) newErrors.vendor = 'Please select a vendor from the list';
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) newErrors.amount = 'Valid amount is required';
    if (!date) newErrors.date = 'Date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({
        vendor,
        vendorId,
        amount: parseFloat(amount),
        date: date!.toISOString(),
        paymentMethod: paymentMethod as any,
        notes,
        currency: 'AUD' // Default
      });
    }
  };

  if (isProcessing) {
    return (
      <View className="flex-1 bg-background p-4 justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-lg text-foreground mt-4">Extracting receipt details...</Text>
        <Text className="text-sm text-muted-foreground mt-2">This may take a few seconds</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background p-4">
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-2xl font-bold text-foreground">Snap Receipt</Text>
        <Pressable
          accessibilityLabel="Close receipt form"
          accessibilityRole="button"
          onPress={onCancel}
          className="p-2 rounded-md"
          testID="receiptform-close"
        >
          <X size={20} color="#374151" />
        </Pressable>
      </View>
      
      {normalizedData && normalizedData.suggestedCorrections.length > 0 && (
        <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
          <Text className="text-yellow-800 font-medium mb-1">Please Review</Text>
          {normalizedData.suggestedCorrections.map((correction, idx) => (
            <Text key={idx} className="text-yellow-700 text-sm">• {correction}</Text>
          ))}
        </View>
      )}
      
      <View className="mb-4">
        <View className="flex-row items-center mb-2">
          {/* Label is handled by ContractorLookupField if we want, but we have OCR confidence icons here */}
        </View>
        <ContractorLookupField
          label="Vendor*"
          value={vendor}
          onChange={(val, contactId) => {
            setVendor(val);
            if (contactId) setVendorId(contactId);
          }}
          placeholder="Who did you pay?"
          error={errors.vendor}
        />
        {normalizedData && (
          <View className="flex-row items-center mt-1">
            <Text className="text-xs text-muted-foreground mr-1">OCR Match:</Text>
            {getConfidenceIcon(normalizedData.confidence.vendor)}
          </View>
        )}
      </View>

      <View className="mb-4">
        <View className="flex-row items-center mb-2">
          <Text className="font-medium text-foreground">Total Amount*</Text>
          {normalizedData && (
            <View className="ml-2">
              {getConfidenceIcon(normalizedData.confidence.total)}
            </View>
          )}
        </View>
        <TextInput
          className={`border rounded-xl p-4 text-base bg-card text-foreground ${
            errors.amount 
              ? 'border-destructive' 
              : normalizedData 
                ? getConfidenceColor(normalizedData.confidence.total)
                : 'border-input'
          }`}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
        />
        {errors.amount && <Text className="text-destructive text-sm mt-1">{errors.amount}</Text>}
      </View>

      <View className="mb-4">
        <View className="flex-row items-center mb-2">
          <Text className="font-medium text-foreground">Date*</Text>
          {normalizedData && (
            <View className="ml-2">
              {getConfidenceIcon(normalizedData.confidence.date)}
            </View>
          )}
        </View>
        <DatePickerInput
          label=""
          value={date}
          onChange={setDate}
          error={errors.date}
        />
      </View>

      <View className="mb-6">
        <OptionList
          label="Payment Method"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={PAYMENT_METHODS}
          testID="option-list-payment-method"
        />
      </View>

      <View className="mb-8">
        <Text className="mb-2 font-medium text-foreground">Notes</Text>
        <TextInput
          className="border border-input rounded-xl p-4 text-base bg-card text-foreground min-h-[100px]"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder="What was this for?"
          placeholderTextColor="#9ca3af"
          textAlignVertical="top"
        />
      </View>

      <View className="flex-row gap-4 mb-8">
        <Pressable 
          onPress={onCancel} 
          disabled={isLoading}
          className="flex-1 bg-secondary p-4 rounded-xl items-center active:opacity-80"
        >
          <Text className="text-secondary-foreground font-semibold text-lg">Cancel</Text>
        </Pressable>
        
        <Pressable 
          onPress={handleSubmit} 
          disabled={isLoading}
          className="flex-1 bg-primary p-4 rounded-xl items-center active:opacity-80"
        >
          <Text className="text-primary-foreground font-bold text-lg">
            {isLoading ? 'Saving...' : 'Save Receipt'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};
