import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SnapReceiptDTO, ReceiptLineItemDTO } from '../application/SnapReceiptUseCase';
import { NormalizedReceipt } from '../application/IReceiptNormalizer';
import DatePickerInput from '../../../components/inputs/DatePickerInput';
import { CheckCircle, AlertCircle, AlertTriangle, X, Plus } from 'lucide-react-native';
import OptionList from '../../../components/inputs/OptionList';
import { ContractorLookupField } from '../../../components/inputs/ContractorLookupField';
import { ProjectPickerModal } from '../../../components/shared/ProjectPickerModal';
import { Project } from '../../../domain/entities/Project';

interface ReceiptFormProps {
  initialValues?: Partial<SnapReceiptDTO>;
  normalizedData?: NormalizedReceipt;  // OCR-extracted data with confidence
  onSubmit: (data: SnapReceiptDTO) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isProcessing?: boolean;  // OCR is running
  /** Pre-selected projectId (e.g. when opened from ProjectDetail) */
  projectId?: string;
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
  isProcessing,
  projectId: propProjectId,
}) => {
  const [vendor, setVendor] = useState(initialValues?.vendor || '');
  const [vendorId, setVendorId] = useState('');

  // ── Project picker state ─────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(
    initialValues?.projectId ?? propProjectId ?? undefined,
  );
  const [selectedProjectName, setSelectedProjectName] = useState<string | undefined>(undefined);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);

  const handleProjectSelect = (project: Project | undefined) => {
    if (project) {
      setSelectedProjectId(project.id);
      setSelectedProjectName(project.name);
    } else {
      setSelectedProjectId(undefined);
      setSelectedProjectName(undefined);
    }
  };
  const [amount, setAmount] = useState(initialValues?.amount?.toString() || '');
  const [date, setDate] = useState<Date | null>(initialValues?.date ? new Date(initialValues.date) : new Date());
  const [paymentMethod, setPaymentMethod] = useState<string>(initialValues?.paymentMethod || 'card');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [lineItems, setLineItems] = useState<ReceiptLineItemDTO[]>(initialValues?.lineItems || []);
  
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

  // ── Line item helpers ──────────────────────────────────────────────────────
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (
    index: number,
    field: keyof ReceiptLineItemDTO,
    value: string,
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'description') {
        item.description = value;
      } else if (field === 'quantity') {
        item.quantity = parseFloat(value) || 0;
        item.total = item.quantity * item.unitPrice;
      } else if (field === 'unitPrice') {
        item.unitPrice = parseFloat(value) || 0;
        item.total = item.quantity * item.unitPrice;
      }

      updated[index] = item;

      // Auto-update amount to match subtotal from line items
      const subtotal = updated.reduce((sum, li) => sum + li.total, 0);
      setAmount(subtotal.toFixed(2));

      return updated;
    });
  };

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
        projectId: selectedProjectId,
        notes,
        currency: 'AUD', // Default
        lineItems: lineItems.length > 0 ? lineItems : undefined,
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

      {/* Project Picker */}
      <View className="mb-4">
        <Text className="font-medium text-foreground mb-2">Project (optional)</Text>
        <TouchableOpacity
          testID="receipt-project-picker-row"
          onPress={() => setProjectPickerVisible(true)}
          className="border border-input rounded-xl p-4 bg-card flex-row items-center justify-between"
        >
          <Text className={selectedProjectId ? 'text-foreground text-base' : 'text-muted-foreground text-base'}>
            {selectedProjectName ?? (selectedProjectId ? selectedProjectId : 'Select a project')}
          </Text>
          <Text className="text-muted-foreground text-xs">▾</Text>
        </TouchableOpacity>
      </View>

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

      {/* ── Line Items (optional) ── */}
      <View className="mb-6" testID="receipt-line-items-section">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-medium text-foreground">Line Items (optional)</Text>
          <Pressable
            testID="receipt-add-line-item"
            onPress={addLineItem}
            className="flex-row items-center bg-primary px-3 py-2 rounded-lg active:opacity-80"
          >
            <Plus size={16} color="#fff" />
            <Text className="text-primary-foreground ml-1 font-medium">Add Item</Text>
          </Pressable>
        </View>

        {lineItems.map((item, index) => (
          <View
            key={index}
            testID={`receipt-line-item-${index}`}
            className="bg-card border border-input rounded-xl p-4 mb-3"
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-medium text-foreground">Item {index + 1}</Text>
              <Pressable
                testID={`receipt-remove-line-item-${index}`}
                onPress={() => removeLineItem(index)}
              >
                <X size={20} color="#ef4444" />
              </Pressable>
            </View>

            <TextInput
              testID={`receipt-line-item-description-${index}`}
              className="border border-input rounded-lg p-2 mb-2 bg-background text-foreground"
              value={item.description}
              onChangeText={(val) => updateLineItem(index, 'description', val)}
              placeholder="Description"
              placeholderTextColor="#9ca3af"
            />

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Qty</Text>
                <TextInput
                  testID={`receipt-line-item-qty-${index}`}
                  className="border border-input rounded-lg p-2 bg-background text-foreground"
                  value={item.quantity.toString()}
                  onChangeText={(val) => updateLineItem(index, 'quantity', val)}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Unit Price</Text>
                <TextInput
                  testID={`receipt-line-item-unitprice-${index}`}
                  className="border border-input rounded-lg p-2 bg-background text-foreground"
                  value={item.unitPrice.toString()}
                  onChangeText={(val) => updateLineItem(index, 'unitPrice', val)}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Total</Text>
                <TextInput
                  testID={`receipt-line-item-total-${index}`}
                  className="border border-input rounded-lg p-2 bg-background text-foreground"
                  value={item.total.toFixed(2)}
                  editable={false}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          </View>
        ))}

        {lineItems.length > 0 && (
          <View className="border-t border-border pt-2 mt-1">
            <Text className="text-sm text-muted-foreground text-right">
              Subtotal: ${lineItems.reduce((s, li) => s + li.total, 0).toFixed(2)}
            </Text>
          </View>
        )}
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
      {/* Project Picker Modal */}
      <ProjectPickerModal
        visible={projectPickerVisible}
        currentProjectId={selectedProjectId}
        onSelect={handleProjectSelect}
        onClose={() => setProjectPickerVisible(false)}
      />
    </ScrollView>
  );
};
