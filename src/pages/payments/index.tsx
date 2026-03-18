import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useNavigation } from '@react-navigation/native';
import { ThemeToggle } from '../../components/ThemeToggle';
import AmountPayableBanner from '../../components/payments/AmountPayableBanner';
import PaymentCard, { PaymentCardPayment } from '../../components/payments/PaymentCard';
import { usePayments } from '../../hooks/usePayments';

export default function PaymentsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const navigation = useNavigation<any>();

  const handlePaymentPress = (p: PaymentCardPayment) => {
    if (p.id.startsWith('invoice-payable:')) {
      navigation.navigate('PaymentDetails', { syntheticRow: p });
    } else {
      navigation.navigate('PaymentDetails', { paymentId: p.id });
    }
  };

  const [contractorSearch, setContractorSearch] = useState('');

  const {
    globalPayments,
    globalAmountPayable,
    loading,
    refresh,
  } = usePayments({
    mode: 'firefighter',
    contractorSearch,
  });

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={isDark ? styles.darkBg : styles.lightBg}
    >
      <View className="px-6 pt-4 pb-3 border-b border-border">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-foreground">Payments</Text>
          <ThemeToggle />
        </View>
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3" style={styles.searchBar}>
          <Search color={iconMuted} size={16} style={{ marginRight: 8 }} />
          <TextInput
            value={contractorSearch}
            onChangeText={setContractorSearch}
            placeholder="Search contractor..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            className="flex-1 text-foreground text-sm py-2"
            returnKeyType="search"
            autoCorrect={false}
          />
          {contractorSearch.length > 0 && (
            <TouchableOpacity onPress={() => setContractorSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-muted-foreground text-xs">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={isDark ? '#fff' : '#000'} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <AmountPayableBanner total={globalAmountPayable} />

        {loading && globalPayments.length === 0 ? (
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} style={styles.loader} />
        ) : globalPayments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text className="text-lg font-semibold text-foreground mb-1">No pending payments</Text>
            <Text className="text-muted-foreground text-sm text-center">
              {contractorSearch
                ? 'No payments match that contractor name.'
                : 'All clear — no pending payments right now.'}
            </Text>
          </View>
        ) : (
          globalPayments.map((p) => (
            <PaymentCard key={p.id} payment={p} onPress={() => handlePaymentPress(p)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkBg: { backgroundColor: '#0f172a' },
  lightBg: { backgroundColor: '#fafbfc' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 128, paddingTop: 16 },
  searchBar: { height: 44 },
  loader: { marginTop: 48 },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 16 },
});