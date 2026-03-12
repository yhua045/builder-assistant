import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronDown, ChevronUp } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';
import { ThemeToggle } from '../../components/ThemeToggle';
import PaymentsSegmentedControl from '../../components/payments/PaymentsSegmentedControl';
import AmountPayableBanner from '../../components/payments/AmountPayableBanner';
import PaymentCard, { PaymentCardPayment } from '../../components/payments/PaymentCard';
import { usePayments, PaymentsMode } from '../../hooks/usePayments';
import { useProjects } from '../../hooks/useProjects';

cssInterop(Search, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronDown, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronUp, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function PaymentsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [mode, setMode] = useState<PaymentsMode>('firefighter');
  const [contractorSearch, setContractorSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [contractCollapsed, setContractCollapsed] = useState(false);
  const [variationCollapsed, setVariationCollapsed] = useState(false);

  const { projects } = useProjects();

  const {
    globalPayments,
    globalAmountPayable,
    contractPayments,
    variationPayments,
    contractTotal,
    variationTotal,
    loading,
    refresh,
  } = usePayments({
    mode,
    projectId: selectedProjectId,
    contractorSearch: mode === 'firefighter' ? contractorSearch : undefined,
  });

  const handleModeChange = (newMode: PaymentsMode) => {
    setMode(newMode);
    setContractorSearch('');
    if (newMode === 'site_manager' && !selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  };

  // ── Firefighter content ───────────────────────────────────────────
  const firefighterContent = (
    <>
      <View className="flex-row items-center bg-card border border-border rounded-xl px-3 mb-3" style={styles.searchBar}>
        <Search className="text-muted-foreground mr-2" size={16} />
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
        globalPayments.map((p) => <PaymentCard key={p.id} payment={p} />)
      )}
    </>
  );

  // ── Site Manager content ──────────────────────────────────────────
  const siteManagerContent = (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.projectPicker}
        className="mb-4"
      >
        {projects.map((proj) => (
          <TouchableOpacity
            key={proj.id}
            onPress={() => setSelectedProjectId(proj.id)}
            className={`px-4 py-2 rounded-full border mr-2 ${
              selectedProjectId === proj.id
                ? 'bg-primary border-primary'
                : 'bg-card border-border'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                selectedProjectId === proj.id ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              {proj.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!selectedProjectId ? (
        <View style={styles.emptyState}>
          <Text className="text-muted-foreground text-sm">Select a project above to view payments.</Text>
        </View>
      ) : loading && contractPayments.length === 0 && variationPayments.length === 0 ? (
        <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} style={styles.loader} />
      ) : (
        <>
          <CollapsibleSection
            title="Contract"
            total={contractTotal}
            collapsed={contractCollapsed}
            onToggle={() => setContractCollapsed((v) => !v)}
          >
            {contractPayments.length === 0 ? (
              <Text className="text-muted-foreground text-xs px-1 pb-2">No contract payments.</Text>
            ) : (
              contractPayments.map((p) => <PaymentCard key={p.id} payment={p as PaymentCardPayment} />)
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Variations"
            total={variationTotal}
            collapsed={variationCollapsed}
            onToggle={() => setVariationCollapsed((v) => !v)}
          >
            {variationPayments.length === 0 ? (
              <Text className="text-muted-foreground text-xs px-1 pb-2">No variation payments.</Text>
            ) : (
              variationPayments.map((p) => <PaymentCard key={p.id} payment={p as PaymentCardPayment} />)
            )}
          </CollapsibleSection>
        </>
      )}
    </>
  );

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
        <PaymentsSegmentedControl value={mode} onChange={handleModeChange} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={isDark ? '#fff' : '#000'} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'firefighter' ? firefighterContent : siteManagerContent}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── CollapsibleSection ────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  total: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, total, collapsed, onToggle, children }: CollapsibleSectionProps) {
  const formattedTotal = new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 0,
  }).format(total);

  return (
    <View className="mb-4">
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        className="flex-row items-center justify-between bg-muted rounded-xl px-4 py-3 mb-2"
      >
        <View>
          <Text className="text-base font-bold text-foreground">{title}</Text>
          <Text className="text-xs text-muted-foreground">{formattedTotal} pending</Text>
        </View>
        {collapsed
          ? <ChevronDown className="text-muted-foreground" size={18} />
          : <ChevronUp className="text-muted-foreground" size={18} />}
      </TouchableOpacity>
      {!collapsed && children}
    </View>
  );
}

const styles = StyleSheet.create({
  darkBg: { backgroundColor: '#0f172a' },
  lightBg: { backgroundColor: '#fafbfc' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 128, paddingTop: 16 },
  searchBar: { height: 44 },
  projectPicker: { paddingBottom: 4 },
  loader: { marginTop: 48 },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 16 },
});