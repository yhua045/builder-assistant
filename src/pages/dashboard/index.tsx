import React from 'react';
import { View, Text, ScrollView, Pressable, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { ProjectOverviewCard } from './components/ProjectOverviewCard';
import HeroSection from './components/HeroSection';
import { Camera, Receipt, DollarSign, FileText, Wrench, X, Plus } from 'lucide-react-native';
import ManualProjectEntry from '../../components/ManualProjectEntry';
import { SnapReceiptScreen } from '../receipts/SnapReceiptScreen';
import { InvoiceScreen } from '../invoices/InvoiceScreen';
import { QuotationScreen } from '../quotations/QuotationScreen';
import TaskScreen from '../tasks/TaskScreen';
import { useDashboard } from '../../hooks/useDashboard';

const quickActions = [
  { id: '1', title: 'Snap Receipt', icon: Camera, color: 'bg-chart-1' },
  { id: '2', title: 'Add Invoice', icon: Receipt, color: 'bg-chart-5' },
  { id: '3', title: 'Log Payment', icon: DollarSign, color: 'bg-chart-2' },
  { id: '4', title: 'Add Quote', icon: FileText, color: 'bg-chart-3' },
  { id: '5', title: 'Ad Hoc Task', icon: Wrench, color: 'bg-chart-4' }
];

export default function DashboardScreen() {
  const vm = useDashboard();

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
          <Text className="text-muted-foreground text-sm">Overview</Text>
        </View>
        <View className="flex-row items-center">
          <ThemeToggle />
        </View>
      </View>

      {/* eslint-disable-next-line react-native/no-inline-styles */}
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {vm.isLoading && (
          <View className="px-6 mt-4">
            <Text className="text-muted-foreground">Loading projects...</Text>
          </View>
        )}

        {vm.error && (
          <View className="px-6 mt-4 p-4 bg-destructive/10 rounded-xl">
            <Text className="text-destructive">Failed to load overview data</Text>
          </View>
        )}

        {!vm.isLoading && !vm.error && !vm.hasProjects && (
          <HeroSection onManualEntry={vm.onManualEntry} />
        )}

        {!vm.isLoading && !vm.error && vm.hasProjects && vm.overviews && (
          <View className="px-6 mt-2">
             <Text className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
               {`Active Projects (${vm.overviews.length})`}
             </Text>
            {vm.overviews.map(overview => (
              <ProjectOverviewCard
                key={overview.project.id}
                overview={overview}
                onPress={() => vm.navigateToProject(overview.project.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Always-mounted ManualProjectEntry — survives hasProjects transition so step 2 task selection is not lost */}
      <ManualProjectEntry key={vm.createKey} initialVisible={vm.createKey > 0} hideButton />

      {/* Quick Actions - Floating Action Button */}
      <View className="absolute bottom-24 right-6">
        <Pressable
          testID="quick-actions-fab"
          onPress={vm.openQuickActions}
          className="bg-primary rounded-full w-16 h-16 items-center justify-center shadow-lg active:opacity-80"
        >
          <Plus className="text-primary-foreground" size={28} />
        </Pressable>
      </View>

      {/* Quick Actions Modal */}
      <Modal
        visible={vm.showQuickActions}
        transparent={true}
        animationType="fade"
        onRequestClose={vm.closeQuickActions}
      >
        <Pressable 
          className="flex-1 justify-end"
          style={styles.modalBackdrop}
          onPress={vm.closeQuickActions}
        >
          <Pressable 
            style={styles.modalContainer}
            className="rounded-t-3xl p-6 dark:bg-[#1e1e1e]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">Quick Actions</Text>
              <Pressable onPress={vm.closeQuickActions}>
                <X className="text-muted-foreground" size={24} />
              </Pressable>
            </View>

            <View className="gap-3">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <Pressable
                    key={action.id}
                    onPress={() => vm.handleQuickAction(action.id)}
                    className="bg-card border border-border rounded-xl p-4 flex-row items-center active:opacity-70"
                  >
                    <View className={`${action.color}/10 p-3 rounded-lg mr-4`}>
                      <IconComponent className={action.color.replace('bg-', 'text-')} size={24} />
                    </View>
                    <Text className="text-foreground font-semibold text-base">{action.title}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="h-8" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Snap Receipt Modal */}
      <Modal
        visible={vm.showSnapReceipt}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={vm.closeSnapReceipt}
      >
        <SnapReceiptScreen
          onClose={vm.closeSnapReceipt}
          enableOcr={true}
          receiptParsingStrategy={vm.receiptParser}
        />
      </Modal>

      {/* Add Invoice Modal */}
      <Modal
        visible={vm.showAddInvoice}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={vm.closeAddInvoice}
        testID="add-invoice-modal"
      >
        <InvoiceScreen
          onClose={vm.closeAddInvoice}
          ocrAdapter={vm.invoiceOcrAdapter}
          invoiceNormalizer={vm.invoiceNormalizer}
          pdfConverter={vm.invoicePdfConverter}
        />
      </Modal>

      {/* Ad Hoc Task (TaskScreen manages its own Modal) */}
      {vm.showAdHocTask && (
        <TaskScreen onClose={vm.closeAdHocTask} />
      )}

      {/* Quotation Modal */}
      <QuotationScreen
        visible={vm.showQuotation}
        onClose={vm.closeQuotation}
        onSuccess={() => {}}
        ocrAdapter={vm.invoiceOcrAdapter}
        pdfConverter={vm.invoicePdfConverter}
        parsingStrategy={vm.quotationParser}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContainer: { backgroundColor: '#ffffff' },
});