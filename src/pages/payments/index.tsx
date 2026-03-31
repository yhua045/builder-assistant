import React from 'react';
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
import { PaymentTypeFilterChips } from '../../components/payments/PaymentTypeFilterChips';
import GlobalQuotationCard from '../../components/payments/GlobalQuotationCard';
import { useGlobalPaymentsScreen } from '../../hooks/useGlobalPaymentsScreen';
import type { Quotation } from '../../domain/entities/Quotation';

const EMPTY_MESSAGES: Record<string, { title: string; subtitle: (hasSearch: boolean) => string }> = {
  quotations: {
    title: 'No quotations found',
    subtitle: (s) => s ? 'No quotations match that vendor name.' : 'No quotations yet. Add one from a project or task.',
  },
  pending: {
    title: 'No pending payments',
    subtitle: (s) => s ? 'No payments match that contractor name.' : 'All clear — no pending payments right now.',
  },
  paid: {
    title: 'No paid payments',
    subtitle: () => 'No paid payments recorded yet.',
  },
  all: {
    title: 'No payments found',
    subtitle: (s) => s ? 'No payments match that search.' : 'No payments found.',
  },
};

export default function PaymentsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconMuted = isDark ? '#a1a1aa' : '#71717a';
  const navigation = useNavigation<any>();

  const {
    filter,
    setFilter,
    search,
    setSearch,
    quotations,
    pendingPayments,
    paidPayments,
    amountPayable,
    loading,
    refresh,
  } = useGlobalPaymentsScreen();

  const handlePaymentPress = (p: PaymentCardPayment) => {
    if (p.id.startsWith('invoice-payable:')) {
      navigation.navigate('PaymentDetails', { syntheticRow: p });
    } else {
      navigation.navigate('PaymentDetails', { paymentId: p.id });
    }
  };

  const handleQuotationPress = (q: Quotation) => {
    navigation.navigate('QuotationDetail', { quotationId: q.id });
  };

  // Derive the list to show based on current filter
  const paymentsToShow: PaymentCardPayment[] =
    filter === 'pending'
      ? pendingPayments
      : filter === 'paid'
      ? paidPayments
      : filter === 'all'
      ? [...pendingPayments, ...paidPayments]
      : [];

  const showBanner = filter === 'pending' || filter === 'all';

  const empty = EMPTY_MESSAGES[filter] ?? EMPTY_MESSAGES.all;
  const listEmpty =
    filter === 'quotations' ? quotations.length === 0 : paymentsToShow.length === 0;

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={isDark ? styles.darkBg : styles.lightBg}
    >
      <View className="px-6 pt-4 pb-3 border-b border-border">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-foreground">Finances</Text>
          <ThemeToggle />
        </View>

        {/* Single flattened 4-option filter chips */}
        <PaymentTypeFilterChips value={filter} onChange={setFilter} isDark={isDark} />

        <View
          className="flex-row items-center bg-card border border-border rounded-xl px-3 mt-3"
          style={styles.searchBar}
        >
          <Search color={iconMuted} size={16} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={filter === 'quotations' ? 'Search vendor...' : 'Search contractor...'}
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            className="flex-1 text-foreground text-sm py-2"
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-muted-foreground text-xs">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={isDark ? '#fff' : '#000'}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {showBanner && <AmountPayableBanner total={amountPayable} />}

        {loading && listEmpty ? (
          <ActivityIndicator
            size="large"
            color={isDark ? '#fff' : '#000'}
            style={styles.loader}
          />
        ) : listEmpty ? (
          <View style={styles.emptyState}>
            <Text className="text-lg font-semibold text-foreground mb-1">{empty.title}</Text>
            <Text className="text-muted-foreground text-sm text-center">
              {empty.subtitle(search.length > 0)}
            </Text>
          </View>
        ) : filter === 'quotations' ? (
          quotations.map((q) => (
            <GlobalQuotationCard
              key={q.id}
              quotation={q}
              onPress={() => handleQuotationPress(q)}
            />
          ))
        ) : (
          paymentsToShow.map((p) => (
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
