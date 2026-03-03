import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Document } from '../../domain/entities/Document';
import { FileText, Plus } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  documents: Document[];
  onAddDocument?: () => void;
  onDocumentPress?: (doc: Document) => void;
  /** Shows a spinner on the Add button while a document is being copied/saved */
  uploading?: boolean;
}

export function TaskDocumentSection({ documents, onAddDocument, onDocumentPress, uploading }: Props) {
  return (
    <View className="bg-card p-4 rounded-lg border border-border">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm font-semibold text-muted-foreground">DOCUMENTS</Text>
        {onAddDocument && (
          <TouchableOpacity
            onPress={uploading ? undefined : onAddDocument}
            disabled={uploading}
            className="flex-row items-center gap-1"
          >
            {uploading ? (
              <ActivityIndicator size="small" />
            ) : (
              <>
                <Plus size={16} className="text-primary" />
                <Text className="text-sm text-primary font-medium">Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {documents.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No documents attached</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => onDocumentPress?.(doc)}
                className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg"
              >
                <FileText size={16} className="text-muted-foreground" />
                <Text className="text-sm text-foreground" numberOfLines={1}>
                  {doc.title || doc.filename || 'Untitled'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
