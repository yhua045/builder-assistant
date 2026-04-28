import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Quotation, QuotationLineItem, QuotationEntity } from '../../../domain/entities/Quotation';
import DatePickerInput from '../../../components/inputs/DatePickerInput';
import { Plus, X, Paperclip, HardHat, UserPlus } from 'lucide-react-native';
import { PdfFileMetadata } from '../../../types/PdfFileMetadata';
import { ProjectPickerModal } from '../../../components/shared/ProjectPickerModal';
import { SubcontractorPickerModal, SubcontractorContact } from '../../tasks/components/SubcontractorPickerModal';
import { QuickAddContractorModal } from '../../../components/inputs/QuickAddContractorModal';
import { useQuickLookup } from '../../../hooks/useQuickLookup';
import { Project } from '../../../domain/entities/Project';

interface QuotationFormProps {
  initialValues?: Partial<Quotation>;
  onSubmit: (data: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** When true, renders with compact padding (embedded inside another screen) */
  embedded?: boolean;
  /** When set, shows a PDF attached indicator with the filename */
  pdfFile?: PdfFileMetadata;
  /** Pre-selected projectId (e.g. when opened from ProjectDetail) */
  projectId?: string;
  /** Pre-selected vendorId (e.g. from OCR-parsed contact) */
  vendorId?: string;
}

export const QuotationForm: React.FC<QuotationFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isLoading,
  embedded = false,
  pdfFile,
  projectId: propProjectId,
  vendorId: propVendorId,
}) => {
  const [reference, setReference] = useState(initialValues?.reference || '');
  const [vendorName, setVendorName] = useState(initialValues?.vendorName || '');
  const [vendorEmail, setVendorEmail] = useState(initialValues?.vendorEmail || '');
  const [vendorAddress, setVendorAddress] = useState(initialValues?.vendorAddress || '');
  const [date, setDate] = useState<Date | null>(
    initialValues?.date ? new Date(initialValues.date) : new Date()
  );
  const [expiryDate, setExpiryDate] = useState<Date | null>(
    initialValues?.expiryDate ? new Date(initialValues.expiryDate) : null
  );
  const [total, setTotal] = useState(initialValues?.total?.toString() || '');
  const [subtotal, setSubtotal] = useState(initialValues?.subtotal?.toString() || '');
  const [taxTotal, _setTaxTotal] = useState(initialValues?.taxTotal?.toString() || '');
  const [currency] = useState(initialValues?.currency || 'AUD');
  const [status] = useState<Quotation['status']>(initialValues?.status || 'draft');
  const [notes, setNotes] = useState(initialValues?.notes || '');

  // ── Project picker state ───────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(
    initialValues?.projectId ?? propProjectId ?? undefined
  );
  const [selectedProjectName, setSelectedProjectName] = useState<string | undefined>(undefined);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);

  // ── Vendor picker state ────────────────────────────────────────────────────
  const [selectedVendor, setSelectedVendor] = useState<SubcontractorContact | undefined>(
    initialValues?.vendorId
      ? { id: initialValues.vendorId, name: initialValues.vendorName ?? '' }
      : propVendorId
      ? { id: propVendorId, name: '' }
      : undefined
  );
  const [vendorPickerVisible, setVendorPickerVisible] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const { quickAdd } = useQuickLookup();

  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(
    initialValues?.lineItems || []
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedProjectId) {
      newErrors.project = 'Project is required';
    }

    if (!date) newErrors.date = 'Date is required';
    if (!total || isNaN(parseFloat(total)) || parseFloat(total) < 0) {
      newErrors.total = 'Valid total amount is required';
    }

    if (expiryDate && date && expiryDate < date) {
      newErrors.expiryDate = 'Expiry date must be on or after issue date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      try {
        const resolvedVendorName = selectedVendor?.name || vendorName || undefined;
        const resolvedVendorEmail = selectedVendor?.email || vendorEmail || undefined;

        const quotationData = {
          reference,
          projectId: selectedProjectId || undefined,
          vendorId: selectedVendor?.id || undefined,
          vendorName: resolvedVendorName,
          vendorEmail: resolvedVendorEmail,
          vendorAddress: vendorAddress || undefined,
          date: date!.toISOString(),
          expiryDate: expiryDate?.toISOString(),
          total: parseFloat(total),
          subtotal: subtotal ? parseFloat(subtotal) : undefined,
          taxTotal: taxTotal ? parseFloat(taxTotal) : undefined,
          currency,
          status,
          notes: notes || undefined,
          lineItems: lineItems.length > 0 ? lineItems : undefined,
        };

        QuotationEntity.create(quotationData as any);

        onSubmit(quotationData as any);
      } catch (error) {
        setErrors({ form: error instanceof Error ? error.message : 'Validation failed' });
      }
    }
  };

  const handleProjectSelect = (project: Project | undefined) => {
    if (project) {
      setSelectedProjectId(project.id);
      setSelectedProjectName(project.name);
    } else {
      setSelectedProjectId(undefined);
      setSelectedProjectName(undefined);
    }
  };

  const handleVendorSelect = (contact: SubcontractorContact | undefined) => {
    setSelectedVendor(contact);
    if (contact?.email) setVendorEmail(contact.email);
    if (contact?.name) setVendorName(contact.name);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof QuotationLineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? parseFloat(value) || 0 : updated[index].quantity || 0;
      const price = field === 'unitPrice' ? parseFloat(value) || 0 : updated[index].unitPrice || 0;
      updated[index].total = qty * price;
    }

    setLineItems(updated);

    const newSubtotal = updated.reduce((sum, item) => sum + (item.total || 0), 0);
    setSubtotal(newSubtotal.toFixed(2));

    if (!taxTotal || parseFloat(taxTotal) === 0) {
      setTotal(newSubtotal.toFixed(2));
    }
  };

  const px = embedded ? 'px-0' : 'px-6';

  return (
    <ScrollView className="flex-1 bg-background">
      {!embedded && (
        <Text className="text-2xl font-bold mb-6 px-6 text-foreground">New Quotation</Text>
      )}

      {errors.form && (
        <View className={`bg-destructive/10 border border-destructive rounded-xl p-3 mb-4 ${px}`}>
          <Text className="text-destructive text-sm">{errors.form}</Text>
        </View>
      )}

      {/* PDF Attached Indicator */}
      {pdfFile && (
        <View
          testID="quotation-pdf-indicator"
          className={`bg-card border border-border rounded-xl p-3 mb-4 flex-row items-center ${px}`}
        >
          <Paperclip size={16} color="#6b7280" />
          <Text className="text-foreground font-medium ml-2 flex-1" numberOfLines={1}>
            {pdfFile.name}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {(pdfFile.size / 1024).toFixed(1)} KB
          </Text>
        </View>
      )}

      {/* Reference (optional) */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">Reference (optional)</Text>
        <TextInput
          testID="quotation-reference-input"
          className="border border-input rounded-xl p-4 text-base bg-card text-foreground"
          value={reference}
          onChangeText={setReference}
          placeholder="Leave blank to auto-generate"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Project Picker */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">
          Project <Text className="text-destructive">*</Text>
        </Text>
        <TouchableOpacity
          testID="quotation-project-picker-row"
          onPress={() => setProjectPickerVisible(true)}
          className={`border rounded-xl p-4 bg-card flex-row items-center justify-between ${errors.project ? 'border-destructive' : 'border-input'}`}
        >
          <Text className={selectedProjectId ? 'text-foreground text-base' : 'text-muted-foreground text-base'}>
            {selectedProjectName ?? (selectedProjectId ? selectedProjectId : 'Select a project')}
          </Text>
          <Text className="text-muted-foreground text-xs">▾</Text>
        </TouchableOpacity>
        {errors.project && (
          <Text testID="quotation-project-error" className="text-destructive text-xs mt-1">
            {errors.project}
          </Text>
        )}
      </View>

      {/* Vendor Picker */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">Client / Vendor</Text>
        <TouchableOpacity
          testID="quotation-vendor-picker-row"
          onPress={() => setVendorPickerVisible(true)}
          className="border border-input rounded-xl p-4 bg-card flex-row items-center"
        >
          <HardHat size={16} color="#6b7280" />
          <Text className={`ml-2 flex-1 text-base ${selectedVendor || vendorName ? 'text-foreground' : 'text-muted-foreground'}`}>
            {selectedVendor
              ? `${selectedVendor.name}${(selectedVendor as any).trade ? ` (${(selectedVendor as any).trade})` : ''}`
              : vendorName ? vendorName : '+ Add Client / Vendor'}
          </Text>
          {(!!(selectedVendor || vendorName)) && (
            <Pressable
              testID="quotation-vendor-edit-button"
              onPress={() => setVendorPickerVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-muted-foreground text-xs">&#9998;</Text>
            </Pressable>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID="quotation-vendor-quick-add-button"
          onPress={() => {
            setVendorPickerVisible(false);
            setQuickAddVisible(true);
          }}
          className="mt-1 flex-row items-center px-1 py-1"
        >
          <UserPlus size={14} color="#6b7280" />
          <Text className="text-muted-foreground text-xs ml-1">Quick add new contact</Text>
        </TouchableOpacity>
      </View>

      {/* Vendor Email */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">Vendor Email</Text>
        <TextInput
          testID="quotation-vendor-email-input"
          className="border border-input rounded-xl p-4 text-base bg-card text-foreground"
          value={vendorEmail}
          onChangeText={setVendorEmail}
          placeholder="vendor@example.com"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Vendor Address */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">Vendor Address</Text>
        <TextInput
          testID="quotation-vendor-address-input"
          className="border border-input rounded-xl p-4 text-base bg-card text-foreground min-h-[80px]"
          value={vendorAddress}
          onChangeText={setVendorAddress}
          placeholder="123 Main St"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>

      {/* Date */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">Issue Date*</Text>
        <DatePickerInput
          label=""
          value={date}
          onChange={setDate}
          error={errors.date}
        />
      </View>

      {/* Expiry Date */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">Expiry Date</Text>
        <DatePickerInput
          label=""
          value={expiryDate}
          onChange={setExpiryDate}
          error={errors.expiryDate}
        />
      </View>

      {/* Line Items */}
      <View className={`mb-4 ${px}`}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-medium text-foreground">Line Items</Text>
          <Pressable
            testID="quotation-add-line-item"
            onPress={addLineItem}
            className="flex-row items-center bg-primary px-3 py-2 rounded-lg active:opacity-80"
          >
            <Plus size={16} color="#fff" />
            <Text className="text-primary-foreground ml-1 font-medium">Add Item</Text>
          </Pressable>
        </View>

        {lineItems.map((item, index) => (
          <View
            key={item.id || index}
            testID={`quotation-line-item-${index}`}
            className="bg-card border border-input rounded-xl p-4 mb-3"
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-medium text-foreground">Item {index + 1}</Text>
              <Pressable onPress={() => removeLineItem(index)}>
                <X size={20} color="#ef4444" />
              </Pressable>
            </View>

            <TextInput
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
                  className="border border-input rounded-lg p-2 bg-background text-foreground"
                  value={item.quantity?.toString() || '1'}
                  onChangeText={(val) => updateLineItem(index, 'quantity', val)}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Unit Price</Text>
                <TextInput
                  className="border border-input rounded-lg p-2 bg-background text-foreground"
                  value={item.unitPrice?.toString() || '0'}
                  onChangeText={(val) => updateLineItem(index, 'unitPrice', val)}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Total</Text>
                <Text className="border border-input rounded-lg p-2 bg-muted text-foreground">
                  {item.total?.toFixed(2) || '0.00'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Total */}
      <View className={`mb-4 ${px}`}>
        <Text className="font-medium text-foreground mb-2">Total*</Text>
        <TextInput
          testID="quotation-total-input"
          className={`border rounded-xl p-4 text-base bg-card text-foreground ${
            errors.total ? 'border-destructive' : 'border-input'
          }`}
          value={total}
          onChangeText={setTotal}
          placeholder="0.00"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
        />
        {errors.total && <Text className="text-destructive text-sm mt-1">{errors.total}</Text>}
      </View>

      {/* Notes */}
      <View className={`mb-8 ${px}`}>
        <Text className="mb-2 font-medium text-foreground">Notes</Text>
        <TextInput
          testID="quotation-notes-input"
          className="border border-input rounded-xl p-4 text-base bg-card text-foreground min-h-[100px]"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder="Additional notes or terms..."
          placeholderTextColor="#9ca3af"
          textAlignVertical="top"
        />
      </View>

      {/* Action Buttons */}
      <View className={`flex-row gap-4 mb-8 mt-6 ${px}`}>
        <Pressable
          testID="quotation-cancel-button"
          onPress={onCancel}
          disabled={isLoading}
          className="flex-1 bg-secondary p-4 rounded-xl items-center active:opacity-80"
        >
          <Text className="text-secondary-foreground font-semibold text-lg">Cancel</Text>
        </Pressable>

        <Pressable
          testID="quotation-save-button"
          onPress={handleSubmit}
          disabled={isLoading}
          className="flex-1 bg-primary p-4 rounded-xl items-center active:opacity-80"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-primary-foreground font-bold text-lg">Save Quotation</Text>
          )}
        </Pressable>
      </View>

      {/* Project Picker Modal */}
      <ProjectPickerModal
        visible={projectPickerVisible}
        currentProjectId={selectedProjectId}
        onSelect={handleProjectSelect}
        onClose={() => setProjectPickerVisible(false)}
      />

      {/* Subcontractor Picker Modal */}
      <SubcontractorPickerModal
        visible={vendorPickerVisible}
        selectedId={selectedVendor?.id}
        onSelect={handleVendorSelect}
        onClose={() => setVendorPickerVisible(false)}
      />

      {/* Quick-add contractor modal */}
      <QuickAddContractorModal
        visible={quickAddVisible}
        onSave={(contact) => {
          const vendor: SubcontractorContact = {
            id: contact.id,
            name: contact.name,
            email: contact.email ?? undefined,
            phone: contact.phone ?? undefined,
          };
          setSelectedVendor(vendor);
          if (contact.email) setVendorEmail(contact.email);
          if (contact.name) setVendorName(contact.name);
          setQuickAddVisible(false);
        }}
        onCancel={() => setQuickAddVisible(false)}
        onQuickAdd={async (input) => {
          const contact = await quickAdd(input);
          return contact;
        }}
      />
    </ScrollView>
  );
};
