import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { NormalizedInvoice } from '../application/IInvoiceNormalizer';
import { CheckCircle, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react-native';

export interface ExtractionResultsPanelProps {
  extractionResult: NormalizedInvoice;
  onAccept: (result: NormalizedInvoice) => void;
  onRetry: () => void;
  onEdit: (result: NormalizedInvoice) => void;
}

export const ExtractionResultsPanel: React.FC<ExtractionResultsPanelProps> = ({
  extractionResult,
  onAccept,
  onRetry,
  onEdit,
}) => {
  const [editedResult, setEditedResult] = useState<NormalizedInvoice>(extractionResult);

  useEffect(() => {
    setEditedResult(extractionResult);
  }, [extractionResult]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#10b981'; // green
    if (confidence >= 0.5) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  // Note: confidence level helper is defined locally where needed (FieldEditor)

  const getConfidenceIcon = (confidence: number) => {
    const color = getConfidenceColor(confidence);
    if (confidence >= 0.8) {
      return <CheckCircle size={16} color={color} />;
    } else if (confidence >= 0.5) {
      return <AlertTriangle size={16} color={color} />;
    } else {
      return <AlertCircle size={16} color={color} />;
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Not detected';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (amount: number | null, currency: string): string => {
    if (amount === null) return 'Not detected';
    const symbol = currency === 'USD' ? '$' : currency;
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleFieldEdit = (field: string, value: any) => {
    const updated = { ...editedResult, [field]: value };
    setEditedResult(updated);
    onEdit(updated);
  };

  const canAccept = editedResult.confidence.overall >= 0.3; // Minimum threshold

  const overallBgStyle = { backgroundColor: `${getConfidenceColor(editedResult.confidence.overall)}20` };
  const overallTextColor = { color: getConfidenceColor(editedResult.confidence.overall) };
  const acceptOpacityStyle = { opacity: canAccept ? 1 : 0.5 };

  return (
    <ScrollView className="bg-background p-4">
      {/* Overall Confidence Badge */}
      <View className="mb-4 p-4 bg-card rounded-lg border border-border">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">Extraction Results</Text>
          <View
            testID="confidence-overall"
            className="flex-row items-center px-3 py-1 rounded-full"
            style={overallBgStyle}
          >
            {getConfidenceIcon(editedResult.confidence.overall)}
            <Text
              className="ml-2 font-medium"
              style={overallTextColor}
            >
              {Math.round(editedResult.confidence.overall * 100)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Suggested Corrections */}
      {editedResult.suggestedCorrections.length > 0 && (
        <View className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <Text className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Suggestions:
          </Text>
          {editedResult.suggestedCorrections.map((suggestion, index) => (
            <Text key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
              • {suggestion}
            </Text>
          ))}
        </View>
      )}

      {/* Vendor */}
      <FieldEditor
        label="Vendor"
        value={editedResult.vendor || ''}
        placeholder="Vendor name not detected"
        confidence={editedResult.confidence.vendor}
        testID="edit-vendor"
        onChangeText={(value) => handleFieldEdit('vendor', value)}
      />

      {/* Invoice Number */}
      <FieldEditor
        label="Invoice Number"
        value={editedResult.invoiceNumber || ''}
        placeholder="Invoice number not detected"
        confidence={editedResult.confidence.invoiceNumber}
        testID="edit-invoice-number"
        onChangeText={(value) => handleFieldEdit('invoiceNumber', value)}
      />

      {/* Invoice Date */}
      <FieldDisplay
        label="Invoice Date"
        value={formatDate(editedResult.invoiceDate)}
        confidence={editedResult.confidence.invoiceDate}
      />

      {/* Due Date */}
      <FieldDisplay
        label="Due Date"
        value={formatDate(editedResult.dueDate)}
        confidence={0.8} // Not tracked separately
      />

      {/* Subtotal */}
      <FieldDisplay
        label="Subtotal"
        value={formatCurrency(editedResult.subtotal, editedResult.currency)}
        confidence={0.8}
      />

      {/* Tax */}
      <FieldDisplay
        label="Tax"
        value={formatCurrency(editedResult.tax, editedResult.currency)}
        confidence={0.8}
      />

      {/* Total */}
      <FieldEditor
        label="Total"
        value={editedResult.total?.toString() || ''}
        placeholder="Total not detected"
        confidence={editedResult.confidence.total}
        testID="edit-total"
        keyboardType="numeric"
        onChangeText={(value) => handleFieldEdit('total', parseFloat(value) || 0)}
      />

      {/* Currency */}
      <FieldDisplay
        label="Currency"
        value={editedResult.currency}
        confidence={1.0}
      />

      {/* Line Items */}
      {editedResult.lineItems.length > 0 && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-muted-foreground mb-2">Line Items</Text>
          <View className="bg-card border border-border rounded-lg overflow-hidden">
            {editedResult.lineItems.map((item, index) => (
              <View
                key={index}
                className={`p-3 ${index !== editedResult.lineItems.length - 1 ? 'border-b border-border' : ''}`}
              >
                <Text className="text-foreground font-medium">{item.description}</Text>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-sm text-muted-foreground">
                    Qty: {item.quantity} × {formatCurrency(item.unitPrice, editedResult.currency)}
                  </Text>
                  <Text className="text-sm font-medium text-foreground">
                    {formatCurrency(item.total, editedResult.currency)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-3 mt-4">
        <Pressable
          testID="accept-button"
          className="flex-1 p-4 bg-primary rounded-lg items-center opacity-100"
          onPress={() => onAccept(editedResult)}
          disabled={!canAccept}
          accessibilityState={{ disabled: !canAccept }}
          style={acceptOpacityStyle}
        >
          <Text className="text-primary-foreground font-semibold">Accept & Save</Text>
        </Pressable>

        <Pressable
          testID="retry-button"
          className="p-4 bg-secondary rounded-lg items-center justify-center"
          onPress={onRetry}
        >
          <RefreshCw size={20} color="#6b7280" />
        </Pressable>
      </View>
    </ScrollView>
  );
};

interface FieldEditorProps {
  label: string;
  value: string;
  placeholder: string;
  confidence: number;
  testID: string;
  keyboardType?: 'default' | 'numeric';
  onChangeText: (value: string) => void;
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  label,
  value,
  placeholder,
  confidence,
  testID,
  keyboardType = 'default',
  onChangeText,
}) => {
  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return '#10b981';
    if (conf >= 0.5) return '#f59e0b';
    return '#ef4444';
  };

  const getConfidenceLevel = (conf: number): string => {
    if (conf >= 0.8) return 'high';
    if (conf >= 0.5) return 'medium';
    return 'low';
  };

  const getConfidenceIcon = (conf: number) => {
    const color = getConfidenceColor(conf);
    if (conf >= 0.8) {
      return <CheckCircle size={14} color={color} />;
    } else if (conf >= 0.5) {
      return <AlertTriangle size={14} color={color} />;
    } else {
      return <AlertCircle size={14} color={color} />;
    }
  };
  const borderStyle = { borderColor: getConfidenceColor(confidence), borderWidth: 1 };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
        <View
          testID={`confidence-${testID.replace('edit-', '')}`}
          className="flex-row items-center"
          accessibilityLabel={`confidence ${getConfidenceLevel(confidence)}`}
        >
          {getConfidenceIcon(confidence)}
          <Text className="ml-1 text-xs text-muted-foreground">
            {Math.round(confidence * 100)}%
          </Text>
        </View>
      </View>

      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        className="p-3 bg-background border rounded-lg text-foreground"
          style={borderStyle}
      />
    </View>
  );
};

interface FieldDisplayProps {
  label: string;
  value: string;
  confidence: number;
}

const FieldDisplay: React.FC<FieldDisplayProps> = ({ label, value, confidence }) => {
  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return '#10b981';
    if (conf >= 0.5) return '#f59e0b';
    return '#ef4444';
  };

  const getConfidenceIcon = (conf: number) => {
    const color = getConfidenceColor(conf);
    if (conf >= 0.8) {
      return <CheckCircle size={14} color={color} />;
    } else if (conf >= 0.5) {
      return <AlertTriangle size={14} color={color} />;
    } else {
      return <AlertCircle size={14} color={color} />;
    }
  };
  const boxStyle = { borderColor: getConfidenceColor(confidence), borderWidth: 1 };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
        <View className="flex-row items-center">
          {getConfidenceIcon(confidence)}
          <Text className="ml-1 text-xs text-muted-foreground">
            {Math.round(confidence * 100)}%
          </Text>
        </View>
      </View>

      <View
        className="p-3 bg-muted rounded-lg"
        style={boxStyle}
      >
        <Text className="text-foreground">{value}</Text>
      </View>
    </View>
  );
};
