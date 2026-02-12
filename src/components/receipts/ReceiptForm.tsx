import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable } from 'react-native';
import { SnapReceiptDTO } from '../../application/usecases/receipt/SnapReceiptUseCase';
import DatePickerInput from '../inputs/DatePickerInput';

interface ReceiptFormProps {
  initialValues?: Partial<SnapReceiptDTO>;
  onSubmit: (data: SnapReceiptDTO) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PAYMENT_METHODS = [
  { label: 'Card', value: 'card' },
  { label: 'Cash', value: 'cash' },
  { label: 'Bank', value: 'bank' },
  { label: 'Other', value: 'other' },
];

export const ReceiptForm: React.FC<ReceiptFormProps> = ({ initialValues, onSubmit, onCancel, isLoading }) => {
  const [vendor, setVendor] = useState(initialValues?.vendor || '');
  const [amount, setAmount] = useState(initialValues?.amount?.toString() || '');
  const [date, setDate] = useState<Date | null>(initialValues?.date ? new Date(initialValues.date) : new Date());
  const [paymentMethod, setPaymentMethod] = useState<string>(initialValues?.paymentMethod || 'card');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!vendor.trim()) newErrors.vendor = 'Vendor is required';
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) newErrors.amount = 'Valid amount is required';
    if (!date) newErrors.date = 'Date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({
        vendor,
        amount: parseFloat(amount),
        date: date!.toISOString(),
        paymentMethod: paymentMethod as any,
        notes,
        currency: 'USD' // Default
      });
    }
  };

  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Text className="text-2xl font-bold mb-6 text-foreground">Snap Receipt</Text>
      
      <View className="mb-4">
        <Text className="mb-2 font-medium text-foreground">Vendor*</Text>
        <TextInput
          className={`border rounded-xl p-4 text-base bg-card text-foreground ${errors.vendor ? 'border-destructive' : 'border-input'}`}
          value={vendor}
          onChangeText={setVendor}
          placeholder="Who did you pay?"
          placeholderTextColor="#9ca3af"
        />
        {errors.vendor && <Text className="text-destructive text-sm mt-1">{errors.vendor}</Text>}
      </View>

      <View className="mb-4">
        <Text className="mb-2 font-medium text-foreground">Total Amount*</Text>
        <TextInput
          className={`border rounded-xl p-4 text-base bg-card text-foreground ${errors.amount ? 'border-destructive' : 'border-input'}`}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
        />
        {errors.amount && <Text className="text-destructive text-sm mt-1">{errors.amount}</Text>}
      </View>

      <View className="mb-4">
        <DatePickerInput
          label="Date*"
          value={date}
          onChange={setDate}
          error={errors.date}
        />
      </View>

      <View className="mb-6">
        <Text className="mb-2 font-medium text-foreground">Payment Method*</Text>
        <View className="flex-row flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => (
             <Pressable
               key={method.value}
               className={`px-4 py-2 rounded-full border ${
                 paymentMethod === method.value 
                   ? 'bg-primary border-primary' 
                   : 'bg-card border-input'
               }`}
               onPress={() => setPaymentMethod(method.value)}
             >
               <Text className={`${
                 paymentMethod === method.value ? 'text-primary-foreground font-medium' : 'text-foreground'
               }`}>{method.label}</Text>
             </Pressable>
          ))}
        </View>
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
