import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Upload, Lightbulb } from 'lucide-react-native';
import ManualProjectEntry from '../../../components/ManualProjectEntry';


export default function HeroSection() {
  return (
    <View className="px-6 mb-8">
      <View className="bg-gradient-to-br from-primary/10 to-chart-1/10 border-2 border-primary/20 rounded-2xl p-6">
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Welcome, Alex! 👋</Text>
          <Text className="text-lg text-foreground/80">Ready to start your first project?</Text>
        </View>

        <Pressable
          className="bg-primary rounded-xl p-5 mb-3 active:opacity-80"
          style={{ elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }}
        >
          <View className="flex-row items-center mb-3">
            <View className="bg-white/20 p-2 rounded-lg mr-3">
              <Upload className="text-white" size={24} />
            </View>
            <Text className="text-white font-bold text-xl flex-1">Upload Signed Contract</Text>
          </View>
          <Text className="text-white/90 text-base ml-11">AI will extract address, owner, and dates</Text>
        </Pressable>

        <ManualProjectEntry />

        <View className="bg-chart-3/10 border border-chart-3/30 rounded-xl p-4 flex-row items-start">
          <Lightbulb className="text-chart-3 mr-3 mt-0.5" size={20} />
          <View className="flex-1">
            <Text className="text-chart-3 font-semibold text-sm mb-1">💡 Helpful Tip</Text>
            <Text className="text-foreground/70 text-sm leading-5">Did you know? You can snap a photo of a receipt in the 'Costs' tab later to track ad-hoc spending.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
