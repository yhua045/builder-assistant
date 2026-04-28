import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import type { DocumentViewDTO } from '../application/TaskViewDTOs';
import { File, Plus } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(File, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  documents: DocumentViewDTO[];
  onAddDocument?: () => void;
  onDocumentPress?: (doc: DocumentViewDTO) => void;
  /** Shows a spinner on the Add button while a document is being copied/saved */
  uploading?: boolean;
}

export function TaskDocumentSection({ documents, onAddDocument, onDocumentPress, uploading }: Props) {
  const renderAttachment = (item: DocumentViewDTO) => {
    const isImage = item.isImage;
    
    return (
      <TouchableOpacity 
        key={item.id} 
        className="mr-3"
        onPress={() => onDocumentPress?.(item)}
      >
        <View className="w-24 h-24 bg-card border border-border rounded-xl overflow-hidden">
          {isImage && (item.displayUri) ? (
            <Image 
              source={{ uri: item.displayUri }} 
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-muted/30">
              <File className="text-muted-foreground" size={32} />
            </View>
          )}
        </View>
        <Text className="text-xs text-muted-foreground mt-2 w-24" numberOfLines={2}>
          {item.title || item.filename || 'Untitled'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="px-6 mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Images & Documents
        </Text>
        {onAddDocument && (
          <TouchableOpacity
            onPress={uploading ? undefined : onAddDocument}
            disabled={uploading}
            className="flex-row items-center gap-2 bg-primary/10 px-3 py-2 rounded-full"
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <>
                <Plus size={16} className="text-primary" />
                <Text className="text-xs text-primary font-semibold">Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {documents.length === 0 ? (
        <View className="bg-card border border-border rounded-2xl p-4">
          <Text className="text-sm text-muted-foreground text-center">No documents attached</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2 }}>
          {documents.map(renderAttachment)}
        </ScrollView>
      )}
    </View>
  );
}
